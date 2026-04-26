from __future__ import annotations

from pathlib import Path
from typing import Generator

from config_loader import get_config_value
from llm_client import LLMClient


APP_ROOT = Path(__file__).resolve().parents[2]
PROMPTS_DIR = APP_ROOT / "prompts"
DEFAULT_MODEL = get_config_value("SCRIPT_JUDGE_MODEL") or "gpt-4.1-2025-04-14"
LLM_TIMEOUT_SECONDS = 90


def read_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


def build_client() -> LLMClient:
    return LLMClient(
        api_env=get_config_value("EFT_API_ENV") or "test",
        timeout=float(LLM_TIMEOUT_SECONDS),
        app_name=get_config_value("APP_NAME") or "calcsense",
        aws_region=get_config_value("AWS_REGION") or "us-east-1",
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
