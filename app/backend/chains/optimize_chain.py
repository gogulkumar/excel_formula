from __future__ import annotations

from typing import Generator

from .base import stream_prompt


def stream_optimization(
    trace_text: str,
    label: str,
    total_nodes: int,
    formula_count: int,
    sheets_involved: list[str],
    model: str,
    max_tokens: int,
) -> Generator[str, None, None]:
    user_text = (
        f"Metric: {label}\n"
        f"Stats: {total_nodes} nodes, {formula_count} formulas, {len(sheets_involved)} sheets ({', '.join(sheets_involved)})\n\n"
        f"Full dependency tree:\n\n{trace_text}\n\nAnalyze this formula tree and determine if it can be optimized."
    )
    yield from stream_prompt(
        prompt_name="optimize_formula.txt",
        user_text=user_text,
        model=model,
        temperature=0.3,
        max_tokens=max_tokens,
        prompt_kind="optimize",
    )
