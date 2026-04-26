from __future__ import annotations

from typing import Generator

from .base import stream_prompt


def stream_workbook_health(context_text: str, model: str, max_tokens: int) -> Generator[str, None, None]:
    user_text = f"Here is the workbook health context:\n\n{context_text}\n\nAssess workbook health."
    yield from stream_prompt(
        prompt_name="workbook_health.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        prompt_kind="explain",
    )
