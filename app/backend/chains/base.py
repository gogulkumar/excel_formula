"""Base utilities for CalcSense LLM chains.

Provides model construction, prompt loading, and both streaming and
structured-output helpers that all chain modules use.
"""

from __future__ import annotations

from pathlib import Path
from typing import Generator, Type

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from config_loader import get_config_value
from llm_client import LLMClient


APP_ROOT = Path(__file__).resolve().parents[2]
PROMPTS_DIR = APP_ROOT / "prompts"
DEFAULT_MODEL = get_config_value("SCRIPT_JUDGE_MODEL") or "gpt-4.1-2025-04-14"
LLM_TIMEOUT_SECONDS = 90


def read_prompt(name: str) -> str:
    """Read a prompt template from the prompts directory."""
    return (PROMPTS_DIR / name).read_text()


def build_client() -> LLMClient:
    """Create an LLMClient instance from environment configuration."""
    return LLMClient(
        api_env=get_config_value("EFT_API_ENV") or "test",
        timeout=float(LLM_TIMEOUT_SECONDS),
        app_name=get_config_value("APP_NAME") or "calcsense",
        aws_region=get_config_value("AWS_REGION") or "us-east-1",
    )


def build_model(
    model: str = "",
    temperature: float = 0.2,
    max_tokens: int = 3000,
    streaming: bool = False,
) -> BaseChatModel:
    """Build a LangChain chat model from environment configuration."""
    client = build_client()
    return client.get_openai_model(
        model=model or DEFAULT_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=streaming,
    )


def stream_prompt(
    *,
    prompt_name: str,
    user_text: str,
    model: str,
    temperature: float,
    max_tokens: int,
    prompt_kind: str = "explain",
) -> Generator[str, None, None]:
    """Stream a prompt through the LLM, yielding text chunks."""
    client = build_client()
    stream = client.stream_openai(
        model=model or DEFAULT_MODEL,
        messages=[{"role": "user", "content": user_text}],
        system_prompt=read_prompt(prompt_name),
        max_tokens=max_tokens,
        temperature=temperature,
        prompt_kind=prompt_kind,
    )
    for chunk in stream:
        if not isinstance(chunk, dict):
            yield chunk


def invoke_structured(
    *,
    prompt_name: str,
    user_text: str,
    model: str,
    temperature: float,
    max_tokens: int,
    output_schema: Type[BaseModel],
) -> BaseModel:
    """Invoke the LLM and parse the response into a Pydantic model.

    Uses LangChain's `.with_structured_output()` for reliable JSON parsing.
    """
    lc_model = build_model(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    structured_model = lc_model.with_structured_output(output_schema)

    prompt = ChatPromptTemplate.from_messages([
        ("system", read_prompt(prompt_name)),
        ("human", "{user_text}"),
    ])
    chain = prompt | structured_model
    return chain.invoke({"user_text": user_text})
