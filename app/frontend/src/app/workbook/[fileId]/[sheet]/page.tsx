"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { ChatPanel } from "@/components/chat-panel";
import { FormatToolbar } from "@/components/format-toolbar";
import { AppHeader } from "@/components/header";
import { TableAnalysisPanel } from "@/components/table-analysis-panel";
import { TracePanel } from "@/components/trace-panel";
import {
  downloadWorkbookUrl,
  editCells,
  fetchCachedExplanations,
  fetchFile,
  fetchSheetStream,
  fetchTables,
  formatCells,
  reloadWorkbook,
  streamBusinessSummary,
  streamExplanation,
  streamReconstruction,
  streamSnapshot,
  traceDown,
  traceUp,
} from "@/lib/api";
import { colToLetter, parseRange } from "@/lib/utils";
import type { Cell, FileEntry, SheetData, TableRegion, TraceNode } from "@/lib/types";

export default function SheetPage() {
  const params = useParams<{ fileId: string; sheet: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = params.fileId;
  const sheet = decodeURIComponent(params.sheet);
  const [file, setFile] = useState<FileEntry | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [tables, setTables] = useState<TableRegion[]>([]);
  const [trace, setTrace] = useState<TraceNode | null>(null);
  const [upTrace, setUpTrace] = useState<TraceNode | null>(null);
  const [view, setView] = useState<"tree" | "diagram" | "explain">("explain");
  const [progress, setProgress] = useState("Loading sheet...");
  const [explanation, setExplanation] = useState("");
  const [businessSummary, setBusinessSummary] = useState("");
  const [reconstruction, setReconstruction] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [reconstructing, setReconstructing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [panelKind, setPanelKind] = useState<"trace" | "tables" | "chat" | null>(null);
  const [renderedPanelKind, setRenderedPanelKind] = useState<"trace" | "tables" | "chat" | null>(null);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [sheetQuery, setSheetQuery] = useState("");
  const [sheetPickerIndex, setSheetPickerIndex] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetPickerListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchFile(fileId).then(setFile);
    void refreshSheet();
  }, [fileId, sheet]);

  const filteredSheets = useMemo(() => {
    const query = sheetQuery.trim().toLowerCase();
    const sheets = file?.sheets || [];
    if (!query) return sheets;
    return sheets.filter((item) => item.toLowerCase().includes(query));
  }, [file?.sheets, sheetQuery]);
  const currentSheetOrdinal = (file?.sheets.findIndex((item) => item === sheet) ?? 0) + 1;

  useEffect(() => {
    const currentIndex = filteredSheets.findIndex((item) => item === sheet);
    setSheetPickerIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [filteredSheets, sheet]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSheetPickerOpen((current) => !current);
        return;
      }
      if (!sheetPickerOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setSheetPickerOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSheetPickerIndex((current) => Math.min(current + 1, Math.max(filteredSheets.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSheetPickerIndex((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const target = filteredSheets[sheetPickerIndex];
        if (!target) return;
        event.preventDefault();
        setSheetPickerOpen(false);
        setSheetQuery("");
        router.push(`/workbook/${fileId}/${encodeURIComponent(target)}`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fileId, filteredSheets, router, sheetPickerIndex, sheetPickerOpen]);

  useEffect(() => {
    if (!sheetPickerOpen) return;
    const active = sheetPickerListRef.current?.querySelector<HTMLElement>(`[data-sheet-index="${sheetPickerIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [sheetPickerIndex, sheetPickerOpen]);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (panelKind) {
      setRenderedPanelKind(panelKind);
      return;
    }
    closeTimer.current = setTimeout(() => {
      setRenderedPanelKind(null);
    }, 320);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [panelKind]);

  async function refreshSheet() {
    await fetchSheetStream(fileId, sheet, setProgress).then(setSheetData);
    await fetchTables(fileId, sheet).then(setTables).catch(() => setTables([]));
  }

  useEffect(() => {
    if (!trace) return;
    setExplanation("");
    setBusinessSummary("");
    setReconstruction("");
    setSnapshot("");
    setExplaining(true);
    setSnapshotting(true);
    setSummarizing(false);
    setReconstructing(false);
    setView("explain");
    if (trace.sheet && trace.cell) {
      void fetchCachedExplanations(fileId, trace.sheet, trace.cell)
        .then((cached) => {
          if (cached.analyst) setExplanation(cached.analyst);
          if (cached.business) setBusinessSummary(cached.business);
        })
        .catch(() => undefined);
    }
    void streamExplanation(
      trace,
      (text) => setExplanation((current) => `${current}${text}`),
      undefined,
      { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
    ).finally(() => setExplaining(false));
    void streamSnapshot(
      trace,
      (text) => setSnapshot((current) => `${current}${text}`),
      undefined,
      { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
    ).finally(() => setSnapshotting(false));
  }, [fileId, trace]);

  const highlightCell = searchParams.get("highlight");

  function getCellMeta(cellRef: string) {
    const parsed = /^([A-Z]+)(\d+)$/.exec(cellRef);
    if (!parsed || !sheetData) return "";
    const row = Number(parsed[2]);
    const colLetters = parsed[1];
    let col = 0;
    for (const ch of colLetters) col = col * 26 + (ch.charCodeAt(0) - 64);
    const labels: string[] = [];
    const rowCells = sheetData.rows[row - 1] || [];
    for (let c = col - 1; c >= 1; c -= 1) {
      const ref = `${colToLetter(c)}${row}`;
      const cell = rowCells.find((item) => item.r === ref);
      if (cell?.v && Number.isNaN(Number(cell.v))) {
        labels.push(cell.v);
        break;
      }
    }
    for (let r = row - 1; r >= 1; r -= 1) {
      const cell = sheetData.rows[r - 1]?.find((item) => item.r === `${colLetters}${r}`);
      if (cell?.v && Number.isNaN(Number(cell.v))) {
        labels.push(cell.v);
        break;
      }
    }
    return labels.join(" - ");
  }

  async function handleTrace(cell: Cell) {
    setSelectedCell(cell);
    if (!cell.f) return;
    setPanelKind("trace");
    const [down, up] = await Promise.all([traceDown(fileId, sheet, cell.r), traceUp(fileId, sheet, cell.r)]);
    const enrich = (node: TraceNode): TraceNode => ({
      ...node,
      meta: getCellMeta(node.cell),
      deps: node.deps.map(enrich),
    });
    setTrace(enrich(down));
    setUpTrace(enrich(up));
  }

  async function handleApplyFormat(format: Record<string, unknown>) {
    if (!selectedCell) return;
    await formatCells(fileId, sheet, [selectedCell.r], format);
    await reloadWorkbook(fileId, sheet);
    await refreshSheet();
  }

  async function handleQuickClear() {
    if (!selectedCell) return;
    await editCells(fileId, sheet, [{ cell: selectedCell.r, value: null }]);
    await refreshSheet();
  }

  async function handleBusinessSummary() {
    if (!trace) return;
    setBusinessSummary("");
    setSummarizing(true);
    try {
      await streamBusinessSummary(
        trace,
        (text) => setBusinessSummary((current) => `${current}${text}`),
        undefined,
        { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
        true,
      );
    } finally {
      setSummarizing(false);
    }
  }

  async function handleReconstruct() {
    if (!trace) return;
    setReconstruction("");
    setReconstructing(true);
    try {
      await streamReconstruction(
        trace,
        (text) => setReconstruction((current) => `${current}${text}`),
        undefined,
        { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
        true,
      );
    } finally {
      setReconstructing(false);
    }
  }

  async function handleSnapshot() {
    if (!trace) return;
    setSnapshot("");
    setSnapshotting(true);
    try {
      await streamSnapshot(
        trace,
        (text) => setSnapshot((current) => `${current}${text}`),
        undefined,
        { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
        true,
      );
    } finally {
      setSnapshotting(false);
    }
  }

  const [activeAnalysisTable, setActiveAnalysisTable] = useState<TableRegion | null>(null);

  const tableBorders = useState(() => new Set<string>())[0];
  useEffect(() => {
    tableBorders.clear();
    const tablesToHighlight = panelKind === "tables" ? (activeAnalysisTable ? [activeAnalysisTable] : tables) : [];
    tablesToHighlight.forEach((table) => {
      const parsed = parseRange(table.range);
      if (!parsed) return;
      for (let r = parsed.r1; r <= parsed.r2; r += 1) {
        for (let c = parsed.c1; c <= parsed.c2; c += 1) {
          tableBorders.add(`${colToLetter(c)}${r}`);
        }
      }
    });
  }, [tableBorders, tables, activeAnalysisTable, panelKind]);

  useEffect(() => {
    if (panelKind !== "tables" && activeAnalysisTable) {
      setActiveAnalysisTable(null);
    }
  }, [panelKind, activeAnalysisTable]);

  const panelVisible = panelKind !== null;


  return (
    <main className="flex h-screen flex-col overflow-hidden bg-bg-deep">
      <AppHeader step={3} filename={file?.filename} fileId={fileId} downloadHref={downloadWorkbookUrl(fileId)} backHref={`/workbook/${fileId}`} />
      <div className="mx-auto flex w-full flex-1 min-h-0 max-w-[1600px] gap-6 px-6 py-6">
        <section className={`${panelVisible ? "w-[45%]" : "w-full"} flex flex-col min-w-0 transition-all duration-300`}>
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-[32px] border border-border-subtle bg-white">
            <div className="flex-none flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle p-5">
              <div>
                <h1 className="text-2xl font-medium">{sheet}</h1>
                <p className="mt-1 text-sm text-text-secondary">{progress}</p>
                <button
                  onClick={() => setSheetPickerOpen(true)}
                  className="mt-3 rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  Switch sheet • {currentSheetOrdinal}/{file?.sheets.length || 0} • Cmd/Ctrl+K
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-2xl bg-accent px-4 py-3 text-white" onClick={() => setPanelKind("tables")}>
                  Analysis
                </button>
                <button className="rounded-2xl bg-violet px-4 py-3 text-white" onClick={() => setPanelKind("chat")}>
                  Chat
                </button>
                <Link href={`/workbook/${fileId}`} className="rounded-2xl border border-border-subtle px-4 py-3 text-sm">All sheets</Link>
              </div>
            </div>
            <div className="flex-none">
              <FormatToolbar disabled={!selectedCell} onApply={handleApplyFormat} />
            </div>
            <div className="flex-none border-b border-border-subtle bg-bg-elevated px-5 py-3 font-mono-ui text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate">{selectedCell?.f || selectedCell?.v || ""}</div>
                {selectedCell ? (
                  <button onClick={() => void handleQuickClear()} className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary">
                    Clear cell
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#fbfaf7] p-4">
              <div className="shadow-sm border border-[#e1dfdd] bg-white rounded-lg overflow-hidden">
                <table className="min-w-full border-collapse select-none">
                  <thead className="sticky top-0 z-10 bg-[#f3f2f1] shadow-sm">
                    <tr>
                      <th className="sticky left-0 border border-[#e1dfdd] bg-[#f3f2f1] px-2 py-1.5 text-center text-[11px] font-semibold text-[#605e5c] uppercase tracking-wider"></th>
                      {(sheetData?.headers || []).map((header) => (
                        <th key={header} className="border border-[#e1dfdd] px-3 py-1.5 text-center text-[11px] font-semibold text-[#605e5c] uppercase tracking-wider">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(sheetData?.rows || []).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td className="sticky left-0 border border-[#e1dfdd] bg-[#f3f2f1] px-2 py-1.5 text-center text-[11px] font-semibold text-[#605e5c]">{rowIndex + 1}</td>
                        {(sheetData?.headers || []).map((header) => {
                          const ref = `${header}${rowIndex + 1}`;
                          const cell = row.find((item) => item.r === ref) || { r: ref, v: "", f: null };
                          const selected = selectedCell?.r === ref;
                          const highlighted = highlightCell === ref;
                          const isTable = tableBorders.has(ref);
                          return (
                            <td key={ref} className={`relative border border-[#e1dfdd] p-0 ${selected ? "z-20" : ""} ${isTable ? "z-10" : ""}`}>
                              <button
                                id={`cell-${ref}`}
                                title={`${cell.m || getCellMeta(ref)} ${cell.f || ""}`.trim()}
                                onClick={() => void handleTrace(cell)}
                                className={`h-8 w-full min-w-[120px] px-2 text-left text-sm tabular-nums outline-none transition-colors ${!isTable && cell.f ? "bg-[#fcfaf8]" : ""} ${!isTable && !cell.f ? "bg-white" : ""} ${selected ? "ring-2 ring-inset ring-[#107c41] bg-[#f2fcf6]" : "hover:bg-[#f3f2f1]"} ${highlighted ? "ring-2 ring-inset ring-blue" : ""} ${isTable && !selected ? "ring-2 ring-inset ring-[#107c41] bg-[#eef5f2]" : ""}`}
                                style={{
                                  backgroundColor: cell.s?.bg || undefined,
                                  color: cell.s?.fg || undefined,
                                  fontWeight: cell.s?.b ? 700 : undefined,
                                  fontStyle: cell.s?.i ? "italic" : undefined,
                                }}
                              >
                                {cell.v || (cell.f ? "" : "")}
                                {cell.f && !cell.v && <span className="text-[10px] text-text-tertiary italic">ƒx</span>}
                                {cell.f && <div className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-l-[6px] border-t-[#107c41] border-l-transparent opacity-60"></div>}
                              </button>
                              {selected && <div className="absolute -bottom-1 -right-1 z-30 h-1.5 w-1.5 bg-[#107c41] border border-white cursor-crosshair shadow-sm"></div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex-none flex gap-2 overflow-auto border-t border-border-subtle bg-bg-elevated p-3">
              {(file?.sheets || []).map((tab) => (
                <button key={tab} onClick={() => router.push(`/workbook/${fileId}/${encodeURIComponent(tab)}`)} className={`rounded-t-2xl border-t-2 px-4 py-3 text-sm ${tab === sheet ? "border-accent bg-white" : "border-transparent hover:border-border-medium"}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </section>
        <aside
          className={`${renderedPanelKind ? "w-[55%] opacity-100" : "pointer-events-none w-[55%] opacity-0"} min-w-0 transition-[margin-right,opacity] duration-[320ms] ease-out will-change-[margin-right,opacity]`}
          style={{ marginRight: panelKind ? 0 : "-55%" }}
        >
          {renderedPanelKind === "trace" ? (
            <TracePanel
              trace={trace}
              traceUp={upTrace}
              view={view}
              onViewChange={setView}
              onClose={() => setPanelKind(null)}
              explanation={explanation}
              explaining={explaining}
              onExplain={() => {
                if (!trace) return;
                setExplanation("");
                setExplaining(true);
                void streamExplanation(
                  trace,
                  (text) => setExplanation((current) => `${current}${text}`),
                  undefined,
                  { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
                  true,
                ).finally(() => setExplaining(false));
              }}
              businessSummary={businessSummary}
              summarizing={summarizing}
              onBusinessSummary={handleBusinessSummary}
              reconstruction={reconstruction}
              reconstructing={reconstructing}
              onReconstruct={handleReconstruct}
              snapshot={snapshot}
              snapshotting={snapshotting}
              onSnapshot={handleSnapshot}
            />
          ) : null}
          {renderedPanelKind === "tables" ? (
            <TableAnalysisPanel
              fileId={fileId}
              sheet={sheet}
              tables={tables}
              onClose={() => {
                setActiveAnalysisTable(null);
                setPanelKind(null);
              }}
              onSelectTable={setActiveAnalysisTable}
            />
          ) : null}
          {renderedPanelKind === "chat" ? (
            <ChatPanel
              fileId={fileId}
              sheet={sheet}
              selectedCell={selectedCell?.r}
              tables={tables}
              onClose={() => setPanelKind(null)}
              onRefresh={refreshSheet}
            />
          ) : null}
        </aside>
      </div>
      {sheetPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/10 px-4 pt-24 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-border-subtle bg-white shadow-[0_30px_90px_rgba(0,0,0,0.14)]">
            <div className="border-b border-border-subtle p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-text-tertiary">Sheet Picker</div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  autoFocus
                  value={sheetQuery}
                  onChange={(event) => setSheetQuery(event.target.value)}
                  placeholder="Search sheets..."
                  className="flex-1 rounded-2xl border border-border-subtle bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  onClick={() => setSheetPickerOpen(false)}
                  className="rounded-2xl border border-border-subtle px-4 py-3 text-sm text-text-secondary"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 text-xs text-text-tertiary">
              <span>{filteredSheets.length} matching sheet{filteredSheets.length !== 1 ? "s" : ""}</span>
              <span>{currentSheetOrdinal} of {file?.sheets.length || 0}</span>
            </div>
            <div ref={sheetPickerListRef} className="max-h-[420px] overflow-auto p-3">
              {filteredSheets.length ? (
                <div className="space-y-2">
                  {filteredSheets.map((item, index) => {
                    const active = index === sheetPickerIndex;
                    const current = item === sheet;
                    return (
                      <button
                        key={item}
                        data-sheet-index={index}
                        onMouseEnter={() => setSheetPickerIndex(index)}
                        onClick={() => {
                          setSheetPickerOpen(false);
                          setSheetQuery("");
                          router.push(`/workbook/${fileId}/${encodeURIComponent(item)}`);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                          active ? "bg-accent text-white" : current ? "bg-accent/10 text-accent" : "bg-bg-elevated text-text-primary hover:bg-border-subtle"
                        }`}
                      >
                        <div>
                          <div className="font-medium">{item}</div>
                          <div className={`mt-1 text-xs ${active ? "text-white/80" : "text-text-tertiary"}`}>
                            {current ? "Current sheet" : "Open this sheet"}
                          </div>
                        </div>
                        <div className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${active ? "bg-white/15 text-white" : "bg-white text-text-tertiary"}`}>
                          {index + 1}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-bg-elevated px-4 py-8 text-center text-sm text-text-secondary">
                  No sheets match “{sheetQuery}”.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
