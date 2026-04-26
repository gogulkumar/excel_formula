from __future__ import annotations

from typing import Generator

from .base import stream_prompt


def stream_business_summary(trace_text: str, model: str, max_tokens: int, label: str) -> Generator[str, None, None]:
    user_text = (
        f"Here is the full dependency tree for the metric '{label}':\n\n"
        f"{trace_text}\n\nExplain this metric from a business perspective."
    )
    yield from stream_prompt(
        prompt_name="business_summary.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        prompt_kind="business",
    )
