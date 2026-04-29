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

  const tableBoundaryMap = useMemo(() => {
    const map = new Map<string, { top: boolean; right: boolean; bottom: boolean; left: boolean }>();
    const tablesToHighlight = panelKind === "tables" ? (activeAnalysisTable ? [activeAnalysisTable] : tables) : [];
    tablesToHighlight.forEach((table) => {
      const parsed = parseRange(table.range);
      if (!parsed) return;
      for (let r = parsed.r1; r <= parsed.r2; r += 1) {
        for (let c = parsed.c1; c <= parsed.c2; c += 1) {
          map.set(`${colToLetter(c)}${r}`, {
            top: r === parsed.r1,
            right: c === parsed.c2,
            bottom: r === parsed.r2,
            left: c === parsed.c1,
          });
        }
      }
    });
    return map;
  }, [tables, activeAnalysisTable, panelKind]);

  useEffect(() => {
    if (panelKind !== "tables" && activeAnalysisTable) {
      setActiveAnalysisTable(null);
    }
  }, [panelKind, activeAnalysisTable]);

  const panelVisible = panelKind !== null;


  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-bg-deep xl:h-screen xl:overflow-hidden">
      <AppHeader step={3} filename={file?.filename} fileId={fileId} downloadHref={downloadWorkbookUrl(fileId)} backHref={`/workbook/${fileId}`} />
      <div className="mx-auto flex w-full flex-1 min-h-0 max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:flex-row xl:gap-6">
        <section className={`${panelVisible ? "xl:w-[45%]" : "xl:w-full"} flex w-full min-w-0 flex-col transition-all duration-300`}>
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-[32px] border border-border-subtle bg-white">
            <div className="flex-none flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle p-4 sm:p-5">
              <div>
                <h1 className="text-xl font-medium sm:text-2xl">{sheet}</h1>
                <p className="mt-1 text-sm text-text-secondary">{progress}</p>
                <button
                  onClick={() => setSheetPickerOpen(true)}
                  className="mt-3 rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  Switch sheet • {currentSheetOrdinal}/{file?.sheets.length || 0} • Cmd/Ctrl+K
                </button>
              </div>
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
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
            <div className="flex-1 overflow-auto bg-[#fbfaf7] p-3 sm:p-4">
              {!sheetData && (
                <div className="space-y-2 p-2">
                  <div className="flex gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="animate-shimmer h-7 rounded flex-1" style={{ animationDelay: `${i * 60}ms` }} />
                    ))}
                  </div>
                  {Array.from({ length: 12 }).map((_, r) => (
                    <div key={r} className="flex gap-2">
                      <div className="animate-shimmer h-7 w-8 rounded flex-none opacity-50" />
                      {Array.from({ length: 6 }).map((_, c) => (
                        <div key={c} className="animate-shimmer h-7 rounded flex-1" style={{ animationDelay: `${(r * 6 + c) * 20}ms`, opacity: 1 - r * 0.05 }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
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
                          const boundary = tableBoundaryMap.get(ref);
                          const isTable = Boolean(boundary);
                          return (
                            <td key={ref} className={`relative border border-[#e1dfdd] p-0 ${selected ? "z-20" : ""} ${isTable ? "z-10" : ""}`}>
                              <button
                                id={`cell-${ref}`}
                                title={`${cell.m || getCellMeta(ref)} ${cell.f || ""}`.trim()}
                                onClick={() => void handleTrace(cell)}
                                className={`h-8 w-full min-w-[96px] px-2 text-left text-xs tabular-nums outline-none transition-colors sm:min-w-[120px] sm:text-sm ${!isTable && cell.f ? "bg-[#fcfaf8]" : ""} ${!isTable && !cell.f ? "bg-white" : ""} ${selected ? "ring-2 ring-inset ring-[#f97316] bg-[#fff7ed]" : "hover:bg-[#f5f4f1]"} ${highlighted ? "ring-2 ring-inset ring-blue" : ""} ${isTable && !selected ? "ring-2 ring-inset ring-[#f97316]/50 bg-[#fff7ed]/60" : ""}`}
                                style={{
                                  backgroundColor: cell.s?.bg || undefined,
                                  color: cell.s?.fg || undefined,
                                  fontWeight: cell.s?.b ? 700 : undefined,
                                  fontStyle: cell.s?.i ? "italic" : undefined,
                                }}
                              >
                                {cell.v || (cell.f ? "" : "")}
                                {cell.f && !cell.v && <span className="text-[10px] text-text-tertiary italic">ƒx</span>}
                                {cell.f && <div className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-l-[6px] border-t-[#f97316] border-l-transparent opacity-60"></div>}
                              </button>
                              {boundary ? (
                                <div className="pointer-events-none absolute inset-0 z-20">
                                  {boundary.top ? <div className="absolute left-0 top-0 h-[2px] w-full bg-[#0f766e]" /> : null}
                                  {boundary.right ? <div className="absolute right-0 top-0 h-full w-[2px] bg-[#0f766e]" /> : null}
                                  {boundary.bottom ? <div className="absolute bottom-0 left-0 h-[2px] w-full bg-[#0f766e]" /> : null}
                                  {boundary.left ? <div className="absolute left-0 top-0 h-full w-[2px] bg-[#0f766e]" /> : null}
                                </div>
                              ) : null}
                              {selected && <div className="absolute -bottom-1 -right-1 z-30 h-1.5 w-1.5 bg-[#f97316] border border-white cursor-crosshair shadow-sm"></div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex-none flex gap-1 overflow-auto border-t border-border-subtle bg-bg-elevated px-3 pt-2 pb-0">
              {(file?.sheets || []).map((tab) => (
                <button
                  key={tab}
                  onClick={() => router.push(`/workbook/${fileId}/${encodeURIComponent(tab)}`)}
                  className={`flex-none rounded-t-xl border-b-2 px-4 pb-2.5 pt-2 text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                    tab === sheet
                      ? "border-accent bg-white text-accent shadow-[0_-1px_3px_rgba(0,0,0,0.06)]"
                      : "border-transparent text-text-secondary hover:border-border-medium hover:text-text-primary"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </section>
        <aside
          className={`${renderedPanelKind ? "max-h-[9999px] w-full opacity-100 xl:w-[55%]" : "pointer-events-none max-h-0 w-full overflow-hidden opacity-0 xl:w-[55%]"} min-w-0 transition-[margin-right,opacity] duration-[320ms] ease-out will-change-[margin-right,opacity]`}
          style={{ marginRight: panelKind ? 0 : 0 }}
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
              sheetData={sheetData}
              onTablesChange={setTables}
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
