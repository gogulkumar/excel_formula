from __future__ import annotations

import re
from typing import Generator

from .base import build_client, read_prompt


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
    if persona == "data":
        return "Data analyst lens. Look for trends, distributions, outliers, quantify everything (e.g. 'Q3 is up 12.4% vs Q2'). End with **Insight:** callout."
    if persona == "business":
        return "Executive QBR format. Lead with headline, then **Drivers** (<=4 bullet), **Watch-outs/Risks** (<=3 bullet). Translate formulas to business meaning."
    return "Answer like a senior FP&A modeler. Lead with formula mechanics, cite exact cell refs in backticks, suggest cleaner rewrites."


def stream_chat_response(user_message: str, context: str, history: list[dict], model: str, max_tokens: int, persona: str) -> Generator[str, None, None]:
    system_prompt = read_prompt("chat.txt") + "\n\n" + _persona_overlay(persona)
    messages: list[dict[str, str]] = []
    for item in history[-10:]:
        role = item.get("role")
        content = str(item.get("content", ""))
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": f"Workbook context:\n{context}\n\nUser request:\n{user_message}"})
    client = build_client()
    stream = client.stream_openai(
        model=model,
        messages=messages,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
        temperature=0.3,
        prompt_kind="explain",
    )
    for chunk in stream:
        if not isinstance(chunk, dict):
            yield chunk
