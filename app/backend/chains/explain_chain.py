"""Technical explanation chain using LangChain.

Streams an analyst-grade formula explanation using LangChain's streaming
interface with the explain_formula prompt template.
"""

from __future__ import annotations

from typing import Generator

from .base import invoke_structured, stream_prompt
from .models import TechnicalExplanation


def stream_technical_explanation(
    trace_text: str, model: str, max_tokens: int, label: str
) -> Generator[str, None, None]:
    """Stream a technical formula explanation (backward-compatible)."""
    user_text = (
        f"Here is the full dependency tree for the metric '{label}':\n\n"
        f"{trace_text}\n\nPlease explain this formula in plain English."
    )
    yield from stream_prompt(
        prompt_name="explain_formula.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        prompt_kind="explain",
    )


def get_technical_explanation_structured(
    trace_text: str, model: str, max_tokens: int, label: str
) -> TechnicalExplanation:
    """Get a structured technical explanation as a Pydantic model."""
    user_text = (
        f"Here is the full dependency tree for the metric '{label}':\n\n"
        f"{trace_text}\n\nPlease explain this formula in plain English."
    )
    return invoke_structured(
        prompt_name="explain_formula.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        output_schema=TechnicalExplanation,
    )
