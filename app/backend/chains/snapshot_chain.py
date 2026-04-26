from __future__ import annotations

from typing import Generator

from .base import stream_prompt


def stream_formula_snapshot(trace_text: str, model: str, max_tokens: int, label: str) -> Generator[str, None, None]:
    user_text = (
        f"Here is the full dependency tree for the metric '{label}':\n\n"
        f"{trace_text}\n\nGenerate a concise formula snapshot."
    )
    yield from stream_prompt(
        prompt_name="formula_snapshot.txt",
        user_text=user_text,
        model=model,
        temperature=0.1,
        max_tokens=max_tokens,
        prompt_kind="explain",
    )
