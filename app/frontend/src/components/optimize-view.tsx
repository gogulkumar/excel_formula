"use client";

import { useState } from "react";

import { streamOptimize } from "@/lib/api";
import type { OptimizeResult, TableMetric } from "@/lib/types";

export function useOptimize(metric: TableMetric | null, activeSheet: string) {
  const [status, setStatus] = useState<"idle" | "running" | "keep" | "optimize" | "error">("idle");
  const [analysisText, setAnalysisText] = useState("");
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!metric?.cells[0]) return;
    setStatus("running");
    setAnalysisText("");
    setResult(null);
    setError(null);
    try {
      await streamOptimize(metric.cells[0], metric.label || activeSheet, (event) => {
        if (typeof event.text === "string") {
          setAnalysisText((current) => `${current}${event.text}`);
        }
        if (event.result) {
          const next = event.result as OptimizeResult;
          setResult(next);
          setStatus(next.verdict);
        }
      });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Optimization failed");
    }
  }

  function reset() {
    setStatus("idle");
    setAnalysisText("");
    setResult(null);
    setError(null);
  }

  return { data: { result, analysisText }, status, error, run, reset };
}

