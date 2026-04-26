"use client";

import { useEffect, useState } from "react";

import { ExplainView } from "@/components/explain-view";
import { MetricFlow } from "@/components/metric-flow";
import { TableView } from "@/components/table-view";
import { fetchTableTrace, streamBusinessSummary, streamExplanation, streamReconstruction, streamSnapshot, traceUp } from "@/lib/api";
import { useOptimize } from "@/components/optimize-view";
import type { TableMetric, TableRegion, TableTraceResult, TraceNode } from "@/lib/types";

export function TableAnalysisPanel({
  fileId,
  sheet,
  tables,
  onClose,
}: {
  fileId: string;
  sheet: string;
  tables: TableRegion[];
  onClose: () => void;
}) {
  const [selectedTable, setSelectedTable] = useState<TableRegion | null>(tables[0] || null);
  const [traceResult, setTraceResult] = useState<TableTraceResult | null>(null);
  const [selectedMetricIndex, setSelectedMetricIndex] = useState(0);
  const [view, setView] = useState<"tree" | "explain" | "table" | "optimize">("tree");
  const [explanation, setExplanation] = useState("");
  const [businessSummary, setBusinessSummary] = useState("");
  const [reconstruction, setReconstruction] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [traceUpNode, setTraceUpNode] = useState<TraceNode | null>(null);

  useEffect(() => {
    if (!selectedTable) return;
    void fetchTableTrace(fileId, sheet, selectedTable.range).then(setTraceResult);
  }, [fileId, selectedTable, sheet]);

  const metric = traceResult?.metrics[selectedMetricIndex] || null;
  const optimize = useOptimize(metric, sheet);

  useEffect(() => {
    if (!metric?.cells[0]) return;
    void traceUp(fileId, metric.cells[0].sheet, metric.cells[0].cell).then(setTraceUpNode);
  }, [fileId, metric]);

  async function handleExplain() {
    if (!metric?.cells[0]) return;
    setExplanation("");
    await streamExplanation(metric.cells[0], (text) => setExplanation((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
  }

  async function handleBusiness() {
    if (!metric?.cells[0]) return;
    setBusinessSummary("");
    await streamBusinessSummary(metric.cells[0], (text) => setBusinessSummary((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
  }

  async function handleReconstruct() {
    if (!metric?.cells[0]) return;
    setReconstruction("");
    await streamReconstruction(metric.cells[0], (text) => setReconstruction((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
  }

  async function handleSnapshot() {
    if (!metric?.cells[0]) return;
    setSnapshot("");
    await streamSnapshot(metric.cells[0], (text) => setSnapshot((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
  }

  return (
    <aside className="animate-slide-in-right flex h-full flex-col rounded-[32px] border border-border-subtle bg-white">
      <div className="border-b border-border-subtle p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Table Analysis</h2>
          <button onClick={onClose} className="rounded-full border border-border-subtle px-3 py-2 text-sm">Close</button>
        </div>
        <div className="mt-4 flex gap-2 overflow-auto">
          {tables.map((table, index) => (
            <button key={table.range} onClick={() => setSelectedTable(table)} className={`rounded-full px-4 py-2 text-sm ${selectedTable?.range === table.range ? "bg-accent text-white" : "bg-bg-elevated"}`}>
              T{index + 1} {table.range}
            </button>
          ))}
        </div>
      </div>
      {!traceResult ? (
        <div className="m-5 h-40 rounded-3xl animate-shimmer" />
      ) : (
        <div className="grid flex-1 gap-0 lg:grid-cols-[260px_1fr]">
          <div className="border-r border-border-subtle p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Metrics</div>
            <div className="mt-3 space-y-2">
              {traceResult.metrics.map((item, index) => (
                <button key={`${item.label}-${index}`} onClick={() => setSelectedMetricIndex(index)} className={`block w-full rounded-2xl p-3 text-left ${selectedMetricIndex === index ? "bg-accent text-white" : "bg-bg-elevated"}`}>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className={`mt-1 font-mono-ui text-xs ${selectedMetricIndex === index ? "text-white/80" : "text-text-secondary"}`}>{item.cells[0]?.cell}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto p-4">
            <div className="mb-4 flex gap-2">
              {["tree", "explain", "table", "optimize"].map((tab) => (
                <button key={tab} onClick={() => setView(tab as typeof view)} className={`rounded-full px-4 py-2 text-sm ${view === tab ? "bg-accent text-white" : "bg-bg-elevated"}`}>
                  {tab}
                </button>
              ))}
            </div>
            {view === "tree" && metric?.cells[0] ? <MetricFlow trace={metric.cells[0]} traceUp={traceUpNode} /> : null}
            {view === "explain" && metric?.cells[0] ? (
              <ExplainView
                explanation={explanation}
                businessSummary={businessSummary}
                reconstruction={reconstruction}
                snapshot={snapshot}
                explaining={false}
                summarizing={false}
                reconstructing={false}
                snapshotting={false}
                onExplain={handleExplain}
                onBusinessSummary={handleBusiness}
                onReconstruct={handleReconstruct}
                onSnapshot={handleSnapshot}
              />
            ) : null}
            {view === "table" ? <TableView metrics={traceResult.metrics} /> : null}
            {view === "optimize" ? (
              <div className="rounded-3xl border border-border-subtle bg-white p-6">
                <button className="rounded-2xl bg-accent px-5 py-3 text-white" onClick={optimize.run}>Analyze Optimization</button>
                <div className="mt-4 whitespace-pre-wrap text-sm text-text-secondary">{optimize.data.analysisText || "Run analysis to review simplifications."}</div>
                {optimize.data.result ? <pre className="mt-4 overflow-auto rounded-2xl bg-bg-elevated p-4 text-xs">{JSON.stringify(optimize.data.result, null, 2)}</pre> : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
}
