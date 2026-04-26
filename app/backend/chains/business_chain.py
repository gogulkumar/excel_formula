"""Business summary chain using LangChain.

Generates executive-friendly business explanations of formula metrics.
"""

from __future__ import annotations

from typing import Generator

from .base import invoke_structured, stream_prompt
from .models import BusinessSummary


def stream_business_summary(
    trace_text: str, model: str, max_tokens: int, label: str
) -> Generator[str, None, None]:
    """Stream a business summary explanation (backward-compatible)."""
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


def get_business_summary_structured(
    trace_text: str, model: str, max_tokens: int, label: str
) -> BusinessSummary:
    """Get a structured business summary as a Pydantic model."""
    user_text = (
        f"Here is the full dependency tree for the metric '{label}':\n\n"
        f"{trace_text}\n\nExplain this metric from a business perspective."
    )
    return invoke_structured(
        prompt_name="business_summary.txt",
        user_text=user_text,
        model=model,
        temperature=0.2,
        max_tokens=max_tokens,
        output_schema=BusinessSummary,
    )
