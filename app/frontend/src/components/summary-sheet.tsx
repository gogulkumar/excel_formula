"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import { fetchTopMetricTrace, fetchTopMetrics, streamTopMetricExplanations } from "@/lib/api";
import type { FileEntry, TopMetric, TopMetricDetail } from "@/lib/types";

const SHEET_COLORS = [
  "bg-accent/10 text-accent border-accent/20",
  "bg-violet/10 text-violet border-violet/20",
  "bg-teal/10 text-teal border-teal/20",
  "bg-blue/10 text-blue border-blue/20",
];

type MetricStage = "idle" | "tracing" | "analyst" | "business" | "blueprint" | "done" | "error";

function formatValue(v: string): string {
  const n = parseFloat(v);
  if (isNaN(n)) return v;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function MetricCard({
  metric,
  detail,
  sheetIndex,
  analystText,
  businessText,
  blueprintText,
  status,
  onExpand,
  expanded,
}: {
  metric: TopMetric;
  detail?: TopMetricDetail;
  sheetIndex: number;
  analystText?: string;
  businessText?: string;
  blueprintText?: string;
  status: MetricStage;
  onExpand: () => void;
  expanded: boolean;
}) {
  const colorClass = SHEET_COLORS[sheetIndex % SHEET_COLORS.length];
  const hasAI = !!(analystText || businessText || blueprintText);
  const statusLabel =
    status === "idle" ? "Ready" :
    status === "tracing" ? "Tracing" :
    status === "analyst" ? "Analyst" :
    status === "business" ? "Business" :
    status === "blueprint" ? "Blueprint" :
    status === "done" ? "Done" : "Error";

  return (
    <div className="rounded-[24px] border border-border-subtle bg-white shadow-sm transition hover:shadow-md">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] font-medium ${colorClass}`}>
                {metric.sheet}
              </span>
              <span className="rounded-full bg-bg-elevated px-2.5 py-0.5 font-mono-ui text-[10px] text-text-tertiary">
                {metric.cell}
              </span>
              <span className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-[10px] text-text-tertiary">
                {statusLabel}
              </span>
              {detail && (
                <span className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-[10px] text-text-tertiary">
                  {detail.sheets_involved.length} sheet{detail.sheets_involved.length !== 1 ? "s" : ""} involved
                </span>
              )}
            </div>
            <div className="mt-2.5 text-base font-semibold tracking-tight text-text-primary truncate">
              {metric.label}
            </div>
            <div className="mt-1.5 font-mono-ui text-xs text-text-secondary truncate">
              {metric.formula}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-semibold tracking-tight text-text-primary">
              {formatValue(metric.value)}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-text-tertiary">current value</div>
          </div>
        </div>

        {detail ? (
          <div className="mt-3 rounded-xl bg-bg-elevated px-3 py-2 font-mono-ui text-[11px] text-text-secondary leading-relaxed line-clamp-2">
            {detail.formula_text}
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-bg-elevated px-3 py-2 text-[11px] text-text-tertiary">
            Trace details loading…
          </div>
        )}
      </div>

      {(analystText || businessText || blueprintText) && (
        <div className="border-t border-border-subtle">
          <button
            onClick={onExpand}
            className="flex w-full items-center justify-between px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-text-tertiary transition hover:text-text-primary"
          >
            <span>AI Insights</span>
            <span className={`transition-transform ${expanded ? "rotate-180" : ""}`}>↓</span>
          </button>
          {expanded && (
            <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
              {analystText && (
                <div className="rounded-2xl border border-border-subtle p-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-accent">Analyst View</div>
                  <div className="prose prose-sm max-w-none text-text-secondary">
                    <ReactMarkdown>{analystText}</ReactMarkdown>
                  </div>
                </div>
              )}
              {businessText && (
                <div className="rounded-2xl border border-border-subtle p-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-teal">Business View</div>
                  <div className="prose prose-sm max-w-none text-text-secondary">
                    <ReactMarkdown>{businessText}</ReactMarkdown>
                  </div>
                </div>
              )}
              {blueprintText && (
                <div className="rounded-2xl border border-border-subtle p-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-violet">Blueprint</div>
                  <div className="prose prose-sm max-w-none text-text-secondary">
                    <ReactMarkdown>{blueprintText}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasAI && (
        <div className="border-t border-border-subtle px-5 py-3">
          <div className="text-[11px] text-text-tertiary">AI explanation available after generation</div>
        </div>
      )}
    </div>
  );
}

export function SummarySheet({ fileId, file }: { fileId: string; file: FileEntry }) {
  const [selectedSheets, setSelectedSheets] = useState<string[]>(file.sheets);
  const [minRefs, setMinRefs] = useState(2);
  const [filterMetric, setFilterMetric] = useState("");
  const [filterSheet, setFilterSheet] = useState("");
  const [metrics, setMetrics] = useState<TopMetric[]>([]);
  const [details, setDetails] = useState<Record<string, TopMetricDetail>>({});
  const [analyst, setAnalyst] = useState<Record<string, string>>({});
  const [business, setBusiness] = useState<Record<string, string>>({});
  const [blueprint, setBlueprint] = useState<Record<string, string>>({});
  const [statusByKey, setStatusByKey] = useState<Record<string, MetricStage>>({});
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progressText, setProgressText] = useState("Scanning workbook outputs…");
  const [error, setError] = useState<string | null>(null);
  const [sheetColorMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    file.sheets.forEach((s, i) => {
      map[s] = i;
    });
    return map;
  });

  const filteredMetrics = useMemo(() => {
    const metricNeedle = filterMetric.trim().toLowerCase();
    const sheetNeedle = filterSheet.trim().toLowerCase();
    return metrics.filter((metric) => {
      const matchesMetric =
        !metricNeedle ||
        metric.label.toLowerCase().includes(metricNeedle) ||
        metric.cell.toLowerCase().includes(metricNeedle) ||
        metric.formula.toLowerCase().includes(metricNeedle);
      const matchesSheet = !sheetNeedle || metric.sheet.toLowerCase().includes(sheetNeedle);
      return matchesMetric && matchesSheet;
    });
  }, [filterMetric, filterSheet, metrics]);

  const sheetGroups = useMemo(() => {
    return filteredMetrics.reduce<Record<string, TopMetric[]>>((acc, metric) => {
      acc[metric.sheet] = acc[metric.sheet] || [];
      acc[metric.sheet].push(metric);
      return acc;
    }, {});
  }, [filteredMetrics]);

  async function handleScan() {
    setScanning(true);
    setError(null);
    setProgressText("Scanning workbook outputs…");
    setMetrics([]);
    setDetails({});
    setAnalyst({});
    setBusiness({});
    setBlueprint({});
    setStatusByKey({});
    setExpandedKeys(new Set());
    try {
      const result = await fetchTopMetrics(fileId, selectedSheets, minRefs);
      setMetrics(result.metrics);
      if (!result.metrics.length) {
        setProgressText("No top-level metrics found.");
        return;
      }
      const nextStatus: Record<string, MetricStage> = {};
      result.metrics.forEach((metric) => {
        nextStatus[`${metric.sheet}!${metric.cell}`] = "tracing";
      });
      setStatusByKey(nextStatus);
      const nextDetails: Record<string, TopMetricDetail> = {};
      for (let index = 0; index < result.metrics.length; index += 1) {
        const metric = result.metrics[index];
        const key = `${metric.sheet}!${metric.cell}`;
        setProgressText(`Tracing ${index + 1}/${result.metrics.length} · ${metric.label}`);
        nextDetails[key] = await fetchTopMetricTrace(fileId, metric.sheet, metric.cell);
        nextStatus[key] = "idle";
        setDetails({ ...nextDetails });
        setStatusByKey({ ...nextStatus });
      }
      setProgressText(`Ready to generate explanations for ${result.metrics.length} metrics.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan workbook metrics");
      setProgressText("Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    void handleScan();
  }, [fileId]);

  async function handleGenerate() {
    if (!Object.keys(details).length) return;
    setGenerating(true);
    setError(null);
    try {
      const traceMetrics = metrics
        .map((metric) => ({ metric, detail: details[`${metric.sheet}!${metric.cell}`] }))
        .filter((item) => item.detail)
        .map((item) => ({ trace: item.detail!.trace }));

      await streamTopMetricExplanations(traceMetrics, (event) => {
        if (event.all_done) {
          setProgressText(`Generated explanations for ${traceMetrics.length} metrics.`);
          setGenerating(false);
          return;
        }
        if (typeof event.metric_index !== "number" || typeof event.type !== "string") return;
        const metric = metrics[event.metric_index];
        if (!metric) return;
        const key = `${metric.sheet}!${metric.cell}`;
        if (event.status === "start") {
          const stage = event.type === "analyst" || event.type === "business" || event.type === "blueprint"
            ? event.type
            : "idle";
          setStatusByKey((prev) => ({ ...prev, [key]: stage }));
          setProgressText(`Generating ${event.type} for ${metric.label}`);
          return;
        }
        if (typeof event.text === "string") {
          if (event.type === "analyst") {
            setAnalyst((prev) => ({ ...prev, [key]: `${prev[key] || ""}${event.text}` }));
            setExpandedKeys((prev) => new Set(prev).add(key));
          } else if (event.type === "business") {
            setBusiness((prev) => ({ ...prev, [key]: `${prev[key] || ""}${event.text}` }));
          } else if (event.type === "blueprint") {
            setBlueprint((prev) => ({ ...prev, [key]: `${prev[key] || ""}${event.text}` }));
          }
          return;
        }
        if (event.status === "done") {
          setStatusByKey((prev) => ({ ...prev, [key]: event.type === "blueprint" ? "done" : prev[key] }));
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate explanations");
      setProgressText("Generation failed.");
      setStatusByKey((prev) => {
        const next = { ...prev };
        for (const metric of metrics) next[`${metric.sheet}!${metric.cell}`] = "error";
        return next;
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[24px] border border-border-subtle bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Workbook Intelligence</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {metrics.length} top-level metric{metrics.length !== 1 ? "s" : ""} detected
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Formulas not referenced by any other cell — these are your workbook outputs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleScan()}
              disabled={scanning}
              className="rounded-2xl border border-border-subtle bg-white px-4 py-2.5 text-sm text-text-primary transition hover:bg-bg-elevated disabled:opacity-60"
            >
              {scanning ? "Scanning…" : "Rescan"}
            </button>
            <button
              onClick={() => void handleGenerate()}
              disabled={generating || !Object.keys(details).length}
              className="rounded-2xl bg-accent px-5 py-2.5 text-sm text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {generating ? "Generating…" : "Generate Explanations"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_0.8fr_1fr_1fr]">
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">Sheets</div>
            <div className="flex flex-wrap gap-2">
              {file.sheets.map((sheet) => {
                const active = selectedSheets.includes(sheet);
                return (
                  <button
                    key={sheet}
                    onClick={() =>
                      setSelectedSheets((prev) =>
                        active ? prev.filter((item) => item !== sheet) : [...prev, sheet],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      active ? "border-accent bg-accent text-white" : "border-border-subtle bg-bg-elevated text-text-secondary"
                    }`}
                  >
                    {sheet}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">Min refs</div>
            <input
              type="range"
              min={1}
              max={10}
              value={minRefs}
              onChange={(event) => setMinRefs(Number(event.target.value))}
              className="w-full"
            />
            <div className="mt-1 text-xs text-text-secondary">{minRefs}</div>
          </label>
          <label className="block">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">Filter metric</div>
            <input
              value={filterMetric}
              onChange={(event) => setFilterMetric(event.target.value)}
              placeholder="Revenue, margin, EBITDA…"
              className="w-full rounded-2xl border border-border-subtle bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">Filter sheet</div>
            <input
              value={filterSheet}
              onChange={(event) => setFilterSheet(event.target.value)}
              placeholder="Forecast, P&L…"
              className="w-full rounded-2xl border border-border-subtle bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 rounded-2xl bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
          {progressText}
          {error ? <div className="mt-2 text-rose">{error}</div> : null}
        </div>
      </div>

      {scanning ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            {progressText}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-36 animate-shimmer rounded-[24px]" />
            ))}
          </div>
        </div>
      ) : !filteredMetrics.length ? (
        <div className="rounded-[24px] border border-border-subtle bg-white p-8 text-center">
          <div className="text-lg font-medium text-text-primary">No metrics match the current filters</div>
          <div className="mt-2 text-sm text-text-secondary">
            Try adjusting the selected sheets, minimum reference threshold, or text filters.
          </div>
        </div>
      ) : (
        Object.entries(sheetGroups).map(([sheet, sheetMetrics]) => (
          <section key={sheet}>
            <div className="mb-4 flex items-center gap-3">
              <div className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${SHEET_COLORS[sheetColorMap[sheet] % SHEET_COLORS.length]}`}>
                {sheet}
              </div>
              <div className="text-sm text-text-secondary">
                {sheetMetrics.length} metric{sheetMetrics.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sheetMetrics.map((metric) => {
                const key = `${metric.sheet}!${metric.cell}`;
                return (
                  <MetricCard
                    key={key}
                    metric={metric}
                    detail={details[key]}
                    sheetIndex={sheetColorMap[metric.sheet]}
                    analystText={analyst[key]}
                    businessText={business[key]}
                    blueprintText={blueprint[key]}
                    status={statusByKey[key] || "idle"}
                    expanded={expandedKeys.has(key)}
                    onExpand={() =>
                      setExpandedKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                  />
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
