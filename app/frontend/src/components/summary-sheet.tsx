"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

import { fetchTopMetricTrace, fetchTopMetrics, streamTopMetricExplanations } from "@/lib/api";
import type { FileEntry, TopMetric, TopMetricDetail } from "@/lib/types";

export function SummarySheet({ fileId, file }: { fileId: string; file: FileEntry }) {
  const [selectedSheets, setSelectedSheets] = useState<string[]>(file.sheets);
  const [minDepth, setMinDepth] = useState(2);
  const [metrics, setMetrics] = useState<TopMetric[]>([]);
  const [details, setDetails] = useState<Record<string, TopMetricDetail>>({});
  const [analyst, setAnalyst] = useState<Record<string, string>>({});
  const [business, setBusiness] = useState<Record<string, string>>({});
  const [blueprint, setBlueprint] = useState<Record<string, string>>({});

  async function scan() {
    const result = await fetchTopMetrics(fileId, selectedSheets, minDepth);
    setMetrics(result.metrics);
    const nextDetails: Record<string, TopMetricDetail> = {};
    for (const metric of result.metrics) {
      nextDetails[`${metric.sheet}!${metric.cell}`] = await fetchTopMetricTrace(fileId, metric.sheet, metric.cell);
    }
    setDetails(nextDetails);
  }

  async function generate() {
    await streamTopMetricExplanations(
      Object.values(details).map((detail) => ({ trace: detail.trace })),
      (event) => {
        if (typeof event.metric_index !== "number" || typeof event.text !== "string" || typeof event.type !== "string") return;
        const metric = metrics[event.metric_index];
        if (!metric) return;
        const key = `${metric.sheet}!${metric.cell}`;
        if (event.type === "analyst") {
          setAnalyst((current) => ({ ...current, [key]: `${current[key] || ""}${event.text}` }));
        } else if (event.type === "business") {
          setBusiness((current) => ({ ...current, [key]: `${current[key] || ""}${event.text}` }));
        } else if (event.type === "blueprint") {
          setBlueprint((current) => ({ ...current, [key]: `${current[key] || ""}${event.text}` }));
        }
      },
    );
  }

  return (
    <div className="rounded-[32px] border border-border-subtle bg-white p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Sheets</div>
          <div className="mt-2 flex max-w-3xl flex-wrap gap-2">
            {file.sheets.map((sheet) => {
              const active = selectedSheets.includes(sheet);
              return (
                <button
                  key={sheet}
                  onClick={() => setSelectedSheets((current) => active ? current.filter((item) => item !== sheet) : [...current, sheet])}
                  className={`rounded-full px-3 py-2 text-sm ${active ? "bg-accent text-white" : "bg-bg-elevated"}`}
                >
                  {sheet}
                </button>
              );
            })}
          </div>
        </div>
        <label className="text-sm">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-text-tertiary">Min refs</div>
          <input type="range" min={1} max={10} value={minDepth} onChange={(e) => setMinDepth(Number(e.target.value))} />
        </label>
        <button className="rounded-2xl bg-accent px-5 py-3 text-white" onClick={scan}>Scan Metrics</button>
        {Object.keys(details).length ? <button className="rounded-2xl bg-teal px-5 py-3 text-white" onClick={generate}>Generate Explanations</button> : null}
      </div>
      <div className="mt-6 space-y-4">
        {metrics.map((metric) => {
          const key = `${metric.sheet}!${metric.cell}`;
          const detail = details[key];
          return (
            <div key={key} className="grid gap-4 rounded-3xl border border-border-subtle p-5 xl:grid-cols-2">
              <div>
                <div className="font-medium">{metric.label}</div>
                <div className="mt-1 font-mono-ui text-xs text-text-secondary">{key}</div>
                <div className="mt-3 font-mono-ui text-xs">{metric.formula}</div>
                <div className="mt-3 text-xs text-text-secondary">{detail?.sheets_involved.join(", ") || "Tracing..."}</div>
                <pre className="mt-3 overflow-auto rounded-2xl bg-bg-elevated p-3 font-mono-ui text-xs text-text-secondary">{detail?.formula_text || "Tracing..."}</pre>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border-subtle p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-accent">Analyst</div>
                  <div className="prose prose-sm max-w-none">{analyst[key] ? <ReactMarkdown>{analyst[key]}</ReactMarkdown> : "Waiting..."}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-teal">Business</div>
                  <div className="prose prose-sm max-w-none">{business[key] ? <ReactMarkdown>{business[key]}</ReactMarkdown> : "Waiting..."}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-violet">Blueprint</div>
                  <div className="prose prose-sm max-w-none">{blueprint[key] ? <ReactMarkdown>{blueprint[key]}</ReactMarkdown> : "Waiting..."}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
