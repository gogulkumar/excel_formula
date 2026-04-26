"""Optimization analysis chain using LangChain with structured output.

Analyzes formula dependency trees and returns a structured optimization
verdict using Pydantic models — no more regex JSON extraction.
"""

from __future__ import annotations

from typing import Generator

from .base import invoke_structured, stream_prompt
from .models import OptimizationVerdict


def stream_optimization(
    trace_text: str,
    label: str,
    total_nodes: int,
    formula_count: int,
    sheets_involved: list[str],
    model: str,
    max_tokens: int,
) -> Generator[str, None, None]:
    """Stream optimization analysis text (backward-compatible)."""
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


def get_optimization_structured(
    trace_text: str,
    label: str,
    total_nodes: int,
    formula_count: int,
    sheets_involved: list[str],
    model: str,
    max_tokens: int,
) -> OptimizationVerdict:
    """Get a structured optimization verdict as a Pydantic model.

    This eliminates the need for regex parsing of JSON from free-text output.
    """
    user_text = (
        f"Metric: {label}\n"
        f"Stats: {total_nodes} nodes, {formula_count} formulas, {len(sheets_involved)} sheets ({', '.join(sheets_involved)})\n\n"
        f"Full dependency tree:\n\n{trace_text}\n\nAnalyze this formula tree and determine if it can be optimized."
    )
    return invoke_structured(
        prompt_name="optimize_formula.txt",
        user_text=user_text,
        model=model,
        temperature=0.3,
        max_tokens=max_tokens,
        output_schema=OptimizationVerdict,
    )
