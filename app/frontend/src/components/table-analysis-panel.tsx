"use client";

import { useEffect, useMemo, useState } from "react";

import { ExplainView } from "@/components/explain-view";
import { MetricFlow } from "@/components/metric-flow";
import { useOptimize } from "@/components/optimize-view";
import { TableView } from "@/components/table-view";
import { fetchTableTrace, saveTables, streamBusinessSummary, streamExplanation, streamReconstruction, streamSnapshot } from "@/lib/api";
import type { SheetData, TableMetric, TableRegion, TableTraceResult } from "@/lib/types";
import { colToLetter, parseCellRef, parseRange } from "@/lib/utils";

function buildRegionFromRange(range: string, previous: TableRegion, sheetData: SheetData | null): TableRegion | null {
  const parsed = parseRange(range);
  if (!parsed) return null;
  const { r1, c1, r2, c2 } = parsed;
  const rows = Math.max(1, r2 - r1 + 1);
  const cols = Math.max(1, c2 - c1 + 1);
  const preview: string[][] = [];
  const headers: string[] = [];

  if (sheetData) {
    for (let rowIndex = r1; rowIndex <= r2 && preview.length < 3; rowIndex += 1) {
      const row: string[] = [];
      for (let colIndex = c1; colIndex <= c2; colIndex += 1) {
        const refCol = colToLetter(colIndex);
        const cell = sheetData.rows[rowIndex - 1]?.find((item) => item.r === `${refCol}${rowIndex}`);
        row.push(cell?.v || "");
      }
      preview.push(row);
    }
    for (let colIndex = c1; colIndex <= c2; colIndex += 1) {
      const refCol = colToLetter(colIndex);
      const cell = sheetData.rows[r1 - 1]?.find((item) => item.r === `${refCol}${r1}`);
      headers.push(cell?.v || previous.headers[colIndex - c1] || `${refCol}`);
    }
  }

  return {
    ...previous,
    range,
    top_left: `${colToLetter(c1)}${r1}`,
    rows,
    cols,
    cells: rows * cols,
    headers: headers.length ? headers : previous.headers,
    preview: preview.length ? preview : previous.preview,
    user_modified: true,
  };
}

function getColumnOptions(table: TableRegion, metrics: TableMetric[]) {
  const parsed = parseRange(table.range);
  if (!parsed) return [];
  const options = new Map<number, string>();
  for (const metric of metrics) {
    const ref = metric.cells[0]?.cell ? parseCellRef(metric.cells[0].cell) : null;
    if (!ref) continue;
    if (ref.col < parsed.c1 || ref.col > parsed.c2) continue;
    const offset = ref.col - parsed.c1;
    const header = table.headers[offset] || `Column ${offset + 1}`;
    options.set(ref.col, header);
  }
  return [...options.entries()].map(([col, header]) => ({ col, header }));
}

function getRowOptions(table: TableRegion, metrics: TableMetric[]) {
  const options = new Set<string>();
  for (const metric of metrics) {
    const label = metric.label?.trim();
    if (label) options.add(label);
  }
  if (options.size) return [...options];
  return table.preview.map((row, index) => row[0] || `Row ${index + 1}`).filter(Boolean);
}

function looksLikeRawMetricLabel(label: string) {
  const trimmed = label.trim();
  return /^.+![A-Z]{1,3}\d+$/i.test(trimmed) || /^value$/i.test(trimmed);
}

function getMetricDisplayLabel(item: TableMetric) {
  const fallback = item.cells[0]?.meta || item.cells[0]?.cell || "Detected metric";
  return looksLikeRawMetricLabel(item.label) ? fallback : item.label;
}

export function TableAnalysisPanel({
  fileId,
  sheet,
  tables,
  sheetData,
  onClose,
  onSelectTable,
  onTablesChange,
}: {
  fileId: string;
  sheet: string;
  tables: TableRegion[];
  sheetData: SheetData | null;
  onClose: () => void;
  onSelectTable?: (table: TableRegion | null) => void;
  onTablesChange?: (tables: TableRegion[]) => void;
}) {
  const [selectedTable, setSelectedTableState] = useState<TableRegion | null>(tables[0] || null);
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
  const [selectedColumn, setSelectedColumn] = useState<"all" | number>("all");
  const [rangeDraft, setRangeDraft] = useState(selectedTable?.range || "");
  const [savingRange, setSavingRange] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [selectedMetricLabel, setSelectedMetricLabel] = useState(selectedTable?.preferences?.selected_metric_label || "");
  const [metricAxis, setMetricAxis] = useState<"row" | "column">(selectedTable?.preferences?.metric_axis || "column");
  const [overrideScope, setOverrideScope] = useState<"row" | "column">("column");
  const [overrideTarget, setOverrideTarget] = useState("");
  const [overrideKind, setOverrideKind] = useState<"metric" | "numeric">("metric");
  const [savingPreferences, setSavingPreferences] = useState(false);

  const setSelectedTable = (table: TableRegion | null) => {
    setSelectedTableState(table);
    setRangeDraft(table?.range || "");
    setSelectedColumn("all");
    setSelectedMetricLabel(table?.preferences?.selected_metric_label || "");
    setMetricAxis(table?.preferences?.metric_axis || "column");
    if (onSelectTable) onSelectTable(table);
  };

  useEffect(() => {
    setSelectedTable(tables[0] || null);
  }, [tables]);

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
  }, [selectedTable, selectedColumn]);

  const columnOptions = useMemo(
    () => (selectedTable && traceResult ? getColumnOptions(selectedTable, traceResult.metrics) : []),
    [selectedTable, traceResult],
  );
  const rowOptions = useMemo(
    () => (selectedTable && traceResult ? getRowOptions(selectedTable, traceResult.metrics) : []),
    [selectedTable, traceResult],
  );

  const filteredMetrics = useMemo(() => {
    if (!traceResult) return [];
    let metrics = traceResult.metrics;
    if (selectedColumn !== "all") {
      metrics = metrics.filter((metric) => {
        const ref = metric.cells[0]?.cell ? parseCellRef(metric.cells[0].cell) : null;
        return ref?.col === selectedColumn;
      });
    }
    if (selectedMetricLabel) {
      metrics = metrics.filter((metric) => metric.label === selectedMetricLabel);
    }
    return metrics;
  }, [selectedColumn, selectedMetricLabel, traceResult]);

  const overrideTargets = overrideScope === "column" ? columnOptions.map((option) => option.header) : rowOptions;

  useEffect(() => {
    if (!overrideTarget && overrideTargets.length) {
      setOverrideTarget(overrideTargets[0]);
    }
  }, [overrideTarget, overrideTargets]);

  useEffect(() => {
    if (selectedMetricIndex >= filteredMetrics.length) {
      setSelectedMetricIndex(0);
    }
  }, [filteredMetrics.length, selectedMetricIndex]);

  const metric = filteredMetrics[selectedMetricIndex] || null;
  const optimize = useOptimize(metric, sheet);

  async function persistTablePreferences(nextPreferences: NonNullable<TableRegion["preferences"]>) {
    if (!selectedTable) return;
    setSavingPreferences(true);
    const updatedTable: TableRegion = {
      ...selectedTable,
      preferences: nextPreferences,
    };
    const nextTables = tables.map((table) => (table.range === selectedTable.range ? updatedTable : table));
    try {
      await saveTables(fileId, sheet, nextTables);
      onTablesChange?.(nextTables);
      setSelectedTable(updatedTable);
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : "Could not save table preferences.");
    } finally {
      setSavingPreferences(false);
    }
  }

  async function handleSaveRange() {
    if (!selectedTable) return;
    const normalized = rangeDraft.trim().toUpperCase();
    if (!parseRange(normalized)) {
      setRangeError("Enter a valid range like A1:F20.");
      return;
    }
    const updated = buildRegionFromRange(normalized, selectedTable, sheetData);
    if (!updated) {
      setRangeError("Could not update that table range.");
      return;
    }
    setSavingRange(true);
    setRangeError("");
    const nextTables = tables.map((table) => (table.range === selectedTable.range ? updated : table));
    try {
      await saveTables(fileId, sheet, nextTables);
      onTablesChange?.(nextTables);
      setSelectedTable(updated);
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : "Could not save table boundaries.");
    } finally {
      setSavingRange(false);
    }
  }

  async function handleMetricLabelChange(label: string) {
    setSelectedMetricLabel(label);
    if (!selectedTable) return;
    await persistTablePreferences({
      metric_axis: metricAxis,
      selected_metric_label: label,
      overrides: selectedTable.preferences?.overrides || [],
    });
  }

  async function handleMetricAxisChange(axis: "row" | "column") {
    setMetricAxis(axis);
    if (!selectedTable) return;
    await persistTablePreferences({
      metric_axis: axis,
      selected_metric_label: selectedMetricLabel,
      overrides: selectedTable.preferences?.overrides || [],
    });
  }

  async function handleSaveOverride() {
    if (!selectedTable || !overrideTarget) return;
    const overrides = selectedTable.preferences?.overrides || [];
    const nextOverrides = [
      ...overrides.filter((item) => !(item.scope === overrideScope && item.target === overrideTarget)),
      { scope: overrideScope, target: overrideTarget, kind: overrideKind },
    ];
    await persistTablePreferences({
      metric_axis: metricAxis,
      selected_metric_label: selectedMetricLabel,
      overrides: nextOverrides,
    });
  }

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
    <aside className="animate-slide-in-right flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-border-subtle bg-white">
      <div className="border-b border-border-subtle p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Table Analysis</h2>
          <button onClick={onClose} className="rounded-full border border-border-subtle px-3 py-2 text-sm">Close</button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tables.map((table, index) => (
            <button key={table.range} onClick={() => setSelectedTable(table)} className={`rounded-full px-4 py-2 text-sm whitespace-nowrap ${selectedTable?.range === table.range ? "bg-accent text-white" : "bg-bg-elevated"}`}>
              T{index + 1} {table.range}
            </button>
          ))}
        </div>
        {selectedTable ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-center gap-2">
              <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Boundary</label>
              <input
                value={rangeDraft}
                onChange={(event) => setRangeDraft(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-sm outline-none transition focus:border-accent"
              />
              <button
                className="rounded-xl bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
                onClick={handleSaveRange}
                disabled={savingRange || rangeDraft.trim().toUpperCase() === selectedTable.range}
              >
                {savingRange ? "Saving..." : "Save boundary"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Interpretation</label>
              <select
                value={metricAxis}
                onChange={(event) => void handleMetricAxisChange(event.target.value as "row" | "column")}
                className="rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-sm outline-none transition focus:border-accent"
              >
                <option value="column">Metrics run by row</option>
                <option value="row">Metrics run by column</option>
              </select>
            {columnOptions.length > 1 ? (
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Analyze column</label>
                <select
                  value={selectedColumn}
                  onChange={(event) => setSelectedColumn(event.target.value === "all" ? "all" : Number(event.target.value))}
                  className="rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-sm outline-none transition focus:border-accent"
                >
                  <option value="all">All detected value columns</option>
                  {columnOptions.map((option) => (
                    <option key={option.col} value={option.col}>
                      {option.header}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {filteredMetrics.length > 1 ? (
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Focus metric</label>
                <select
                  value={selectedMetricLabel}
                  onChange={(event) => void handleMetricLabelChange(event.target.value)}
                  className="max-w-[220px] rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-sm outline-none transition focus:border-accent"
                >
                  <option value="">All detected metrics</option>
                  {filteredMetrics.map((item) => (
                    <option key={`${item.label}-${item.cells[0]?.cell || ""}`} value={item.label}>
                      {getMetricDisplayLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            </div>
          </div>
        ) : null}
        {selectedTable ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Override role</label>
            <select
              value={overrideScope}
              onChange={(event) => {
                setOverrideScope(event.target.value as "row" | "column");
                setOverrideTarget("");
              }}
              className="rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-sm outline-none transition focus:border-accent"
            >
              <option value="column">Column</option>
              <option value="row">Row</option>
            </select>
            <select
              value={overrideTarget}
              onChange={(event) => setOverrideTarget(event.target.value)}
              className="max-w-[220px] rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-sm outline-none transition focus:border-accent"
            >
              {overrideTargets.map((target) => (
                <option key={target} value={target}>
                  {target}
                </option>
              ))}
            </select>
            <select
              value={overrideKind}
              onChange={(event) => setOverrideKind(event.target.value as "metric" | "numeric")}
              className="rounded-xl border border-border-subtle bg-bg-deep px-3 py-2 text-sm outline-none transition focus:border-accent"
            >
              <option value="metric">Metric</option>
              <option value="numeric">Numeric</option>
            </select>
            <button
              className="rounded-xl bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
              onClick={() => void handleSaveOverride()}
              disabled={!overrideTarget || savingPreferences}
            >
              {savingPreferences ? "Saving..." : "Apply role"}
            </button>
            {(selectedTable.preferences?.overrides || []).map((item) => (
              <div key={`${item.scope}-${item.target}`} className="rounded-full border border-border-subtle bg-bg-deep px-3 py-1.5 text-xs text-text-secondary">
                {item.scope}: {item.target} {"->"} {item.kind}
              </div>
            ))}
          </div>
        ) : null}
        {rangeError ? <div className="mt-2 text-sm text-rose">{rangeError}</div> : null}
      </div>
      {!traceResult ? (
        <div className="m-5 h-40 rounded-3xl animate-shimmer" />
      ) : (
        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[260px_1fr]">
          <div className="flex min-h-0 flex-col border-r border-[#e1dfdd] bg-[#fbfaf7] p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a19f9d]">Metrics</div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="flex flex-col gap-2">
                {filteredMetrics.map((item, index) => (
                  <button key={`${item.label}-${index}`} onClick={() => setSelectedMetricIndex(index)} className={`block w-full rounded-xl p-3.5 text-left transition-all hover:-translate-y-0.5 ${selectedMetricIndex === index ? "bg-white shadow-md ring-1 ring-[#e1dfdd] scale-[1.02]" : "bg-transparent hover:bg-[#edebe9]"}`}>
                    <div className={`text-sm font-semibold ${selectedMetricIndex === index ? "text-accent" : "text-[#323130]"}`}>{getMetricDisplayLabel(item)}</div>
                    <div className={`mt-1.5 font-mono-ui text-[10px] tracking-wider ${selectedMetricIndex === index ? "text-[#605e5c]" : "text-[#a19f9d]"}`}>{item.cells[0]?.cell}</div>
                  </button>
                ))}
                {filteredMetrics.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-subtle bg-white px-4 py-5 text-sm text-text-secondary">
                    No traced metrics were found for that column selection.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {["tree", "explain", "table", "optimize"].map((tab) => (
                  <button key={tab} onClick={() => setView(tab as typeof view)} className={`rounded-full px-4 py-2 text-sm whitespace-nowrap ${view === tab ? "bg-accent text-white" : "bg-bg-elevated"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
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
                {view === "table" ? <TableView metrics={filteredMetrics} /> : null}
                {view === "optimize" ? (
                  <div className="rounded-3xl border border-border-subtle bg-white p-6">
                    <button className="rounded-2xl bg-accent px-5 py-3 text-white" onClick={optimize.run}>Analyze Optimization</button>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-text-secondary">{optimize.data.analysisText || "Run analysis to review simplifications."}</div>
                    {optimize.data.result ? <pre className="mt-4 overflow-auto rounded-2xl bg-bg-elevated p-4 text-xs">{JSON.stringify(optimize.data.result, null, 2)}</pre> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
