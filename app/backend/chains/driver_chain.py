from __future__ import annotations

from typing import Generator

from .base import stream_prompt


def stream_driver_ranking(context_text: str, model: str, max_tokens: int, label: str) -> Generator[str, None, None]:
    user_text = f"Metric: {label}\n\nHere is the driver analysis context:\n\n{context_text}\n\nRank the important drivers."
    yield from stream_prompt(
        prompt_name="driver_ranking.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        prompt_kind="explain",
    )
