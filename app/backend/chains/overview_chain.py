from __future__ import annotations

from typing import Generator

from .base import stream_prompt


def stream_workbook_overview(context_text: str, model: str, max_tokens: int) -> Generator[str, None, None]:
    user_text = f"Here is the workbook context:\n\n{context_text}\n\nGenerate a workbook overview."
    yield from stream_prompt(
        prompt_name="workbook_overview.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        prompt_kind="explain",
    )
