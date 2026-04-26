"""Pydantic output models for all CalcSense LLM chains.

These models are used with LangChain's `.with_structured_output()` to get
typed, validated responses instead of free-text that needs regex parsing.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TechnicalExplanation(BaseModel):
    """Analyst-grade methodology breakdown of a formula."""

    methodology: str = Field(
        description="Bullet-point methodology breakdown explaining how the formula works at each level of the dependency tree."
    )
    formula_definition: str = Field(
        description="Compact formula definition using descriptive metric names instead of raw cell references."
    )


class BusinessSummary(BaseModel):
    """Executive-friendly business explanation of a metric."""

    what_is_this: str = Field(description="Plain-English explanation of what this metric represents.")
    how_calculated: str = Field(description="How the metric is calculated, expressed in business terms without cell references.")
    base_inputs: list[str] = Field(
        default_factory=list,
        description="List of the base input descriptions that feed into this metric.",
    )


class OptimizationVerdict(BaseModel):
    """Structured optimization analysis result."""

    verdict: Literal["keep", "optimize"] = Field(description="Whether to keep the formula as-is or optimize it.")
    reason: str = Field(description="Explanation of why the formula should be kept or optimized.")
    suggestions: list[str] = Field(default_factory=list, description="Concrete optimization suggestions, if any.")
    optimized_formula: str | None = Field(default=None, description="Suggested optimized formula rewrite, if applicable.")


class FormulaSnapshot(BaseModel):
    """Concise one-line formula definition using metric names."""

    definition: str = Field(description="Single-line formula in the format 'MetricName = Expression' using descriptive metric names.")


class FormulaBlueprint(BaseModel):
    """Full formula reconstruction and improvement analysis."""

    original_logic: str = Field(description="Step-by-step walkthrough of how the original formula is built.")
    reconstructed: str = Field(description="Clean rebuild of the formula using best practices like named ranges and helper columns.")
    improvements: list[str] = Field(
        default_factory=list,
        description="Concrete improvements for readability, maintainability, and performance.",
    )


class DriverRanking(BaseModel):
    """Ranked list of drivers for a metric."""

    drivers: list[str] = Field(default_factory=list, description="Ranked list of key drivers for the metric.")
    analysis: str = Field(default="", description="Brief analysis of the driver ranking.")
