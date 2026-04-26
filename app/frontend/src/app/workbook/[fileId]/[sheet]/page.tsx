"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [showTracePanel, setShowTracePanel] = useState(false);
  const [showTablePanel, setShowTablePanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);

  useEffect(() => {
    void fetchFile(fileId).then(setFile);
    void refreshSheet();
  }, [fileId, sheet]);

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
    );
    void streamSnapshot(
      trace,
      (text) => setSnapshot((current) => `${current}${text}`),
      undefined,
      { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
    );
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
    setShowTablePanel(false);
    setShowChatPanel(false);
    setShowTracePanel(true);
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
    await streamBusinessSummary(
      trace,
      (text) => setBusinessSummary((current) => `${current}${text}`),
      undefined,
      { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
      true,
    );
  }

  async function handleReconstruct() {
    if (!trace) return;
    setReconstruction("");
    await streamReconstruction(
      trace,
      (text) => setReconstruction((current) => `${current}${text}`),
      undefined,
      { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
      true,
    );
  }

  async function handleSnapshot() {
    if (!trace) return;
    setSnapshot("");
    await streamSnapshot(
      trace,
      (text) => setSnapshot((current) => `${current}${text}`),
      undefined,
      { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
      true,
    );
  }

  const tableBorders = useMemo(() => {
    const cells = new Set<string>();
    tables.forEach((table) => {
      const parsed = parseRange(table.range);
      if (!parsed) return;
      for (let r = parsed.r1; r <= parsed.r2; r += 1) {
        for (let c = parsed.c1; c <= parsed.c2; c += 1) {
          cells.add(`${colToLetter(c)}${r}`);
        }
      }
    });
    return cells;
  }, [tables]);

  return (
    <main className="min-h-screen bg-bg-deep">
      <AppHeader step={3} filename={file?.filename} fileId={fileId} downloadHref={downloadWorkbookUrl(fileId)} backHref={`/workbook/${fileId}`} />
      <div className="mx-auto flex max-w-[1600px] gap-6 px-6 py-8">
        <section className={`${showTracePanel || showTablePanel || showChatPanel ? "w-[45%]" : "w-full"} min-w-0 transition-all`}>
          <div className="rounded-[32px] border border-border-subtle bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle p-5">
              <div>
                <h1 className="text-2xl font-medium">{sheet}</h1>
                <p className="mt-1 text-sm text-text-secondary">{progress}</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-2xl bg-accent px-4 py-3 text-white" onClick={() => {
                  setShowTracePanel(false);
                  setShowChatPanel(false);
                  setShowTablePanel(true);
                }}>
                  Analysis
                </button>
                <button className="rounded-2xl bg-violet px-4 py-3 text-white" onClick={() => {
                  setShowTracePanel(false);
                  setShowTablePanel(false);
                  setShowChatPanel(true);
                }}>
                  Chat
                </button>
                <Link href={`/workbook/${fileId}`} className="rounded-2xl border border-border-subtle px-4 py-3 text-sm">All sheets</Link>
              </div>
            </div>
            <FormatToolbar disabled={!selectedCell} onApply={handleApplyFormat} />
            <div className="border-b border-border-subtle bg-bg-elevated px-5 py-3 font-mono-ui text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="truncate">{selectedCell?.f || selectedCell?.v || ""}</div>
                {selectedCell ? (
                  <button onClick={() => void handleQuickClear()} className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary">
                    Clear cell
                  </button>
                ) : null}
              </div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-bg-deep">
                  <tr>
                    <th className="sticky left-0 border-b border-r border-border-subtle bg-bg-deep px-4 py-3 text-left text-xs text-text-tertiary">#</th>
                    {(sheetData?.headers || []).map((header) => (
                      <th key={header} className="border-b border-border-subtle px-4 py-3 text-left text-xs text-text-tertiary">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(sheetData?.rows || []).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="sticky left-0 border-r border-border-subtle bg-bg-deep px-4 py-3 text-xs text-text-tertiary">{rowIndex + 1}</td>
                      {(sheetData?.headers || []).map((header) => {
                        const ref = `${header}${rowIndex + 1}`;
                        const cell = row.find((item) => item.r === ref) || { r: ref, v: "", f: null };
                        const selected = selectedCell?.r === ref;
                        const highlighted = highlightCell === ref;
                        const isTable = tableBorders.has(ref);
                        return (
                          <td key={ref} className="border-b border-border-subtle p-0">
                            <button
                              id={`cell-${ref}`}
                              title={`${cell.m || getCellMeta(ref)} ${cell.f || ""}`.trim()}
                              onClick={() => void handleTrace(cell)}
                              className={`h-12 w-full min-w-[120px] px-3 text-left text-sm transition ${cell.f ? "bg-teal/10" : "bg-white"} ${selected ? "ring-2 ring-accent" : ""} ${highlighted ? "ring-2 ring-blue" : ""} ${isTable ? "border border-teal/30 bg-teal/5" : ""}`}
                              style={{
                                backgroundColor: cell.s?.bg || undefined,
                                color: cell.s?.fg || undefined,
                                fontWeight: cell.s?.b ? 700 : undefined,
                                fontStyle: cell.s?.i ? "italic" : undefined,
                              }}
                            >
                              {cell.v || (cell.f ? "ƒx" : "")}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 overflow-auto border-t border-border-subtle bg-bg-elevated p-3">
              {(file?.sheets || []).map((tab) => (
                <button key={tab} onClick={() => router.push(`/workbook/${fileId}/${encodeURIComponent(tab)}`)} className={`rounded-t-2xl border-t-2 px-4 py-3 text-sm ${tab === sheet ? "border-accent bg-white" : "border-transparent hover:border-border-medium"}`}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </section>
        {showTracePanel ? (
          <section className="w-[55%] min-w-0">
            <TracePanel
              trace={trace}
              traceUp={upTrace}
              view={view}
              onViewChange={setView}
              onClose={() => setShowTracePanel(false)}
              explanation={explanation}
              explaining={!explanation}
              onExplain={() => trace && streamExplanation(trace, (text) => setExplanation((current) => `${current}${text}`), undefined, { file_id: fileId, sheet: trace.sheet, cell: trace.cell }, true)}
              businessSummary={businessSummary}
              summarizing={false}
              onBusinessSummary={handleBusinessSummary}
              reconstruction={reconstruction}
              reconstructing={false}
              onReconstruct={handleReconstruct}
              snapshot={snapshot}
              snapshotting={false}
              onSnapshot={handleSnapshot}
            />
          </section>
        ) : null}
        {showTablePanel ? (
          <section className="w-[55%] min-w-0">
            <TableAnalysisPanel fileId={fileId} sheet={sheet} tables={tables} onClose={() => setShowTablePanel(false)} />
          </section>
        ) : null}
        {showChatPanel ? (
          <section className="w-[55%] min-w-0">
            <ChatPanel
              fileId={fileId}
              sheet={sheet}
              selectedCell={selectedCell?.r}
              tables={tables}
              onClose={() => setShowChatPanel(false)}
              onRefresh={refreshSheet}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
