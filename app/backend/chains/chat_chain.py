"""LangGraph-based chat agent for CalcSense workbook analysis.

Uses a LangGraph StateGraph with persona-based routing:
  Router → Formula Analyst | Data Analyst | Business Advisor → Respond

The graph classifies user intent, routes to the appropriate persona node,
and streams the response back.
"""

from __future__ import annotations

import operator
from typing import Annotated, Generator, Literal, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from .base import build_client, read_prompt, DEFAULT_MODEL


# ─── Persona Detection ──────────────────────────────────────────────────────

_PERSONA_DATA_HINTS = (
    "trend", "distribution", "outlier", "average", "median", "stddev", "correlation",
    "yoy", "year over year", "growth rate", "anomaly", "spike", "dip", "histogram",
    "p-value", "regression", "forecast", "seasonality", "data analy",
)
_PERSONA_BUSINESS_HINTS = (
    "summary", "executive", "review", "stakeholder", "exec ", "leadership",
    "narrative", "story", "talking points", "presentation", "qbr", "earnings",
    "board", "memo", "headline", "tldr",
)
_PERSONA_EXCEL_HINTS = (
    "formula", "sumifs", "vlookup", "xlookup", "index", "match", "named range",
    "cell", "sheet", "workbook", "pivot", "rewrite", "optimi",
)


def infer_persona(message: str, mode: str) -> str:
    """Classify user intent into a persona: excel, data, or business."""
    if mode in {"excel", "data", "business"}:
        return mode
    lowered = message.lower()
    if any(hint in lowered for hint in _PERSONA_BUSINESS_HINTS):
        return "business"
    if any(hint in lowered for hint in _PERSONA_DATA_HINTS):
        return "data"
    if any(hint in lowered for hint in _PERSONA_EXCEL_HINTS):
        return "excel"
    return "excel"


def _persona_overlay(persona: str) -> str:
    """Return persona-specific system prompt overlay."""
    if persona == "data":
        return "Data analyst lens. Look for trends, distributions, outliers, quantify everything (e.g. 'Q3 is up 12.4% vs Q2'). End with **Insight:** callout."
    if persona == "business":
        return "Executive QBR format. Lead with headline, then **Drivers** (<=4 bullet), **Watch-outs/Risks** (<=3 bullet). Translate formulas to business meaning."
    return "Answer like a senior FP&A modeler. Lead with formula mechanics, cite exact cell refs in backticks, suggest cleaner rewrites."


# ─── LangGraph State ─────────────────────────────────────────────────────────

def _add_messages(left: list[BaseMessage], right: list[BaseMessage]) -> list[BaseMessage]:
    """Reducer that appends new messages to existing list."""
    return left + right


class ChatState(TypedDict):
    """State for the CalcSense chat graph."""
    messages: Annotated[list[BaseMessage], _add_messages]
    workbook_context: str
    persona: str
    response: str


# ─── Graph Nodes ─────────────────────────────────────────────────────────────

def router_node(state: ChatState) -> ChatState:
    """Classify the user's intent and set the persona."""
    last_msg = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            last_msg = msg.content if isinstance(msg.content, str) else str(msg.content)
            break
    persona = infer_persona(last_msg, state.get("persona", "auto"))
    return {"messages": [], "workbook_context": state["workbook_context"], "persona": persona, "response": ""}


def _respond_with_persona(state: ChatState, model_name: str, max_tokens: int) -> ChatState:
    """Core response generation using the resolved persona."""
    persona = state.get("persona", "excel")
    system_prompt = read_prompt("chat.txt") + "\n\n" + _persona_overlay(persona)

    client = build_client()
    # Build messages for the LLM
    messages: list[dict[str, str]] = []
    for msg in state["messages"]:
        if isinstance(msg, HumanMessage):
            messages.append({"role": "user", "content": msg.content if isinstance(msg.content, str) else str(msg.content)})
        elif isinstance(msg, AIMessage):
            messages.append({"role": "assistant", "content": msg.content if isinstance(msg.content, str) else str(msg.content)})

    # Call LLM
    result = client.call_openai(
        model=model_name,
        messages=messages,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
        temperature=0.3,
    )
    response_text = str(result.get("response_text", ""))
    return {
        "messages": [AIMessage(content=response_text)],
        "workbook_context": state["workbook_context"],
        "persona": persona,
        "response": response_text,
    }


def excel_analyst_node(state: ChatState) -> ChatState:
    """Formula/Excel analyst response node."""
    return _respond_with_persona(state, DEFAULT_MODEL, 4096)


def data_analyst_node(state: ChatState) -> ChatState:
    """Data analyst response node."""
    return _respond_with_persona(state, DEFAULT_MODEL, 4096)


def business_advisor_node(state: ChatState) -> ChatState:
    """Business/executive advisor response node."""
    return _respond_with_persona(state, DEFAULT_MODEL, 4096)


def route_by_persona(state: ChatState) -> str:
    """Conditional edge: route to the right persona node."""
    persona = state.get("persona", "excel")
    if persona == "data":
        return "data_analyst"
    if persona == "business":
        return "business_advisor"
    return "excel_analyst"


# ─── Graph Construction ─────────────────────────────────────────────────────

def build_chat_graph():
    """Build and compile the LangGraph chat agent.

    Graph structure:
        router → (excel_analyst | data_analyst | business_advisor) → END
    """
    from langgraph.graph import END, StateGraph

    graph = StateGraph(ChatState)

    # Add nodes
    graph.add_node("router", router_node)
    graph.add_node("excel_analyst", excel_analyst_node)
    graph.add_node("data_analyst", data_analyst_node)
    graph.add_node("business_advisor", business_advisor_node)

    # Set entry point
    graph.set_entry_point("router")

    # Router conditionally routes to persona nodes
    graph.add_conditional_edges(
        "router",
        route_by_persona,
        {
            "excel_analyst": "excel_analyst",
            "data_analyst": "data_analyst",
            "business_advisor": "business_advisor",
        },
    )

    # All persona nodes go to END
    graph.add_edge("excel_analyst", END)
    graph.add_edge("data_analyst", END)
    graph.add_edge("business_advisor", END)

    return graph.compile()


# Lazily compiled graph singleton
_chat_graph = None


def _get_chat_graph():
    global _chat_graph
    if _chat_graph is None:
        _chat_graph = build_chat_graph()
    return _chat_graph


# ─── Public Interface (streaming, backward-compatible) ───────────────────────

def stream_chat_response(
    user_message: str,
    context: str,
    history: list[dict],
    model: str,
    max_tokens: int,
    persona: str,
) -> Generator[str, None, None]:
    """Stream a chat response using the LangGraph agent.

    This maintains the same signature as the original function, so
    main.py routes don't need to change.
    """
    # Build LangChain message history
    messages: list[BaseMessage] = []
    for item in history[-10:]:
        role = item.get("role")
        content = str(item.get("content", ""))
        if role == "user" and content:
            messages.append(HumanMessage(content=content))
        elif role == "assistant" and content:
            messages.append(AIMessage(content=content))

    # Add the current user message with workbook context
    messages.append(HumanMessage(content=f"Workbook context:\n{context}\n\nUser request:\n{user_message}"))

    # Run the graph
    graph = _get_chat_graph()
    initial_state: ChatState = {
        "messages": messages,
        "workbook_context": context,
        "persona": persona if persona != "auto" else "",
        "response": "",
    }

    result = graph.invoke(initial_state)
    response = result.get("response", "")
    if response:
        yield response
