from __future__ import annotations

from typing import Generator

from .base import stream_prompt


def stream_formula_reconstruction(trace_text: str, model: str, max_tokens: int, label: str) -> Generator[str, None, None]:
    user_text = (
        f"Here is the full dependency tree for the metric '{label}':\n\n"
        f"{trace_text}\n\nShow me how to reconstruct this formula from scratch and how it could be rewritten more cleanly."
    )
    yield from stream_prompt(
        prompt_name="formula_reconstruction.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        prompt_kind="explain",
    )
