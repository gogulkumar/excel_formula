"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { streamBatchExplain } from "@/lib/api";
import type { TableMetric } from "@/lib/types";

export function TableView({ metrics }: { metrics: TableMetric[] }) {
  const [results, setResults] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!metrics.length) return;
    setResults({});
    void streamBatchExplain(
      metrics.map((metric) => ({ label: metric.label, trace: metric.cells[0] })),
      (event) => {
        if (typeof event.metric_index === "number" && typeof event.text === "string") {
          setResults((current) => ({
            ...current,
            [event.metric_index as number]: `${current[event.metric_index as number] || ""}${event.text as string}`,
          }));
        }
      },
    );
  }, [metrics]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border-subtle bg-white">
      <div className="grid grid-cols-4 gap-0 border-b border-border-subtle bg-bg-elevated px-4 py-3 text-xs uppercase tracking-[0.2em] text-text-tertiary">
        <div>Metric</div>
        <div>Value</div>
        <div>Formula lineage</div>
        <div>Explanation</div>
      </div>
      {metrics.map((metric, index) => (
        <div key={`${metric.label}-${index}`} className="grid grid-cols-4 gap-0 border-b border-border-subtle px-4 py-4 text-sm">
          <div>
            <div className="font-medium">{metric.label}</div>
            <div className="mt-1 font-mono-ui text-xs text-text-secondary">{metric.cells[0]?.sheet}!{metric.cells[0]?.cell}</div>
          </div>
          <div className="font-mono-ui">{metric.cells[0]?.value}</div>
          <div className="font-mono-ui text-xs text-text-secondary">{metric.cells[0]?.formula}</div>
          <div className="prose prose-sm max-w-none">{results[index] ? <ReactMarkdown>{results[index]}</ReactMarkdown> : "Waiting..."}</div>
        </div>
      ))}
    </div>
  );
}

