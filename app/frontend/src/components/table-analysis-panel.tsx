"use client";

import { useEffect, useState } from "react";

import { ExplainView } from "@/components/explain-view";
import { MetricFlow } from "@/components/metric-flow";
import { TableView } from "@/components/table-view";
import { fetchTableTrace, streamBusinessSummary, streamExplanation, streamReconstruction, streamSnapshot } from "@/lib/api";
import { useOptimize } from "@/components/optimize-view";
import type { TableMetric, TableRegion, TableTraceResult } from "@/lib/types";

export function TableAnalysisPanel({
  fileId,
  sheet,
  tables,
  onClose,
  onSelectTable,
}: {
  fileId: string;
  sheet: string;
  tables: TableRegion[];
  onClose: () => void;
  onSelectTable?: (table: TableRegion | null) => void;
}) {
  const [selectedTable, setSelectedTableState] = useState<TableRegion | null>(tables[0] || null);

  const setSelectedTable = (table: TableRegion | null) => {
    setSelectedTableState(table);
    if (onSelectTable) onSelectTable(table);
  };

  useEffect(() => {
    if (onSelectTable) {
      onSelectTable(tables[0] || null);
    }
  }, [tables, onSelectTable]);
  const [traceResult, setTraceResult] = useState<TableTraceResult | null>(null);
  const [selectedMetricIndex, setSelectedMetricIndex] = useState(0);
  const [view, setView] = useState<"tree" | "explain" | "table" | "optimize">("tree");
  const [explanation, setExplanation] = useState("");
  const [businessSummary, setBusinessSummary] = useState("");
  const [reconstruction, setReconstruction] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [reconstructing, setReconstructing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  useEffect(() => {
    if (!selectedTable) return;
    void fetchTableTrace(fileId, sheet, selectedTable.range).then(setTraceResult);
  }, [fileId, selectedTable, sheet]);

  useEffect(() => {
    setSelectedMetricIndex(0);
    setExplanation("");
    setBusinessSummary("");
    setReconstruction("");
    setSnapshot("");
    setExplaining(false);
    setSummarizing(false);
    setReconstructing(false);
    setSnapshotting(false);
  }, [selectedTable]);

  useEffect(() => {
    setExplanation("");
    setBusinessSummary("");
    setReconstruction("");
    setSnapshot("");
    setExplaining(false);
    setSummarizing(false);
    setReconstructing(false);
    setSnapshotting(false);
  }, [selectedMetricIndex]);

  const metric = traceResult?.metrics[selectedMetricIndex] || null;
  const optimize = useOptimize(metric, sheet);

  async function handleExplain() {
    if (!metric?.cells[0]) return;
    setExplanation("");
    setExplaining(true);
    try {
      await streamExplanation(metric.cells[0], (text) => setExplanation((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
    } finally {
      setExplaining(false);
    }
  }

  async function handleBusiness() {
    if (!metric?.cells[0]) return;
    setBusinessSummary("");
    setSummarizing(true);
    try {
      await streamBusinessSummary(metric.cells[0], (text) => setBusinessSummary((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
    } finally {
      setSummarizing(false);
    }
  }

  async function handleReconstruct() {
    if (!metric?.cells[0]) return;
    setReconstruction("");
    setReconstructing(true);
    try {
      await streamReconstruction(metric.cells[0], (text) => setReconstruction((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
    } finally {
      setReconstructing(false);
    }
  }

  async function handleSnapshot() {
    if (!metric?.cells[0]) return;
    setSnapshot("");
    setSnapshotting(true);
    try {
      await streamSnapshot(metric.cells[0], (text) => setSnapshot((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: metric.cells[0].sheet, cell: metric.cells[0].cell }, true);
    } finally {
      setSnapshotting(false);
    }
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
          <div className="border-r border-[#e1dfdd] bg-[#fbfaf7] p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a19f9d]">Metrics</div>
            <div className="mt-4 flex flex-col gap-2">
              {traceResult.metrics.map((item, index) => (
                <button key={`${item.label}-${index}`} onClick={() => setSelectedMetricIndex(index)} className={`block w-full rounded-xl p-3.5 text-left transition-all hover:-translate-y-0.5 ${selectedMetricIndex === index ? "bg-white shadow-md ring-1 ring-[#e1dfdd] scale-[1.02]" : "bg-transparent hover:bg-[#edebe9]"}`}>
                  <div className={`text-sm font-semibold ${selectedMetricIndex === index ? "text-[#107c41]" : "text-[#323130]"}`}>{item.label}</div>
                  <div className={`mt-1.5 font-mono-ui text-[10px] tracking-wider ${selectedMetricIndex === index ? "text-[#605e5c]" : "text-[#a19f9d]"}`}>{item.cells[0]?.cell}</div>
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
            {view === "tree" && metric?.cells[0] ? <MetricFlow key={`${selectedMetricIndex}-${metric.cells[0].cell}`} trace={metric.cells[0]} /> : null}
            {view === "explain" && metric?.cells[0] ? (
              <ExplainView
                explanation={explanation}
                businessSummary={businessSummary}
                reconstruction={reconstruction}
                snapshot={snapshot}
                explaining={explaining}
                summarizing={summarizing}
                reconstructing={reconstructing}
                snapshotting={snapshotting}
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
