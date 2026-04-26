import { API } from "@/lib/constants";
import type {
  FileEntry,
  IndexingProgress,
  LocalFileEntry,
  OptimizeResult,
  SheetData,
  TableRegion,
  TableTraceResult,
  TopMetric,
  TopMetricDetail,
  TraceNode,
} from "@/lib/types";

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function parseSse(
  res: Response,
  onEvent: (event: Record<string, unknown>) => void,
) {
  if (!res.body) throw new Error("No reader");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    for (const line of parts) {
      if (!line.startsWith("data: ")) continue;
      onEvent(JSON.parse(line.slice(6)));
    }
  }
}

export function fetchRegistry() {
  return readJson<FileEntry[]>(`${API}/api/files`);
}

export function fetchLocalFiles() {
  return readJson<LocalFileEntry[]>(`${API}/api/local-files`);
}

export function importLocalFile(path: string) {
  return readJson<{ file_id: string; filename: string; sheets: string[] }>(`${API}/api/local-files/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export function fetchFile(fileId: string) {
  return readJson<FileEntry>(`${API}/api/files/${fileId}`);
}

export async function uploadFile(
  file: File,
  handlers: {
    onProgress?: (message: string, indexing?: IndexingProgress) => void;
    onDone?: (payload: { file_id: string; filename: string; sheets: string[] }) => void;
  },
) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API}/api/upload`, { method: "POST", body });
  await parseSse(res, (event) => {
    if (event.error) throw new Error(String(event.error));
    if (event.progress) handlers.onProgress?.(String(event.progress), event.indexing as IndexingProgress | undefined);
    if (event.done) handlers.onDone?.(event as { file_id: string; filename: string; sheets: string[] });
  });
}

export function deleteFileEntry(fid: string) {
  return readJson<{ ok: boolean }>(`${API}/api/files/${fid}`, { method: "DELETE" });
}

export function fetchSheet(fid: string, sheet: string) {
  return readJson<SheetData>(`${API}/api/sheet/${fid}/${encodeURIComponent(sheet)}`);
}

export async function fetchSheetStream(
  fid: string,
  sheet: string,
  onProgress?: (message: string) => void,
) {
  const res = await fetch(`${API}/api/sheet-stream/${fid}/${encodeURIComponent(sheet)}`);
  let out: SheetData | null = null;
  await parseSse(res, (event) => {
    if (event.progress) onProgress?.(String(event.progress));
    if (event.done) out = event.data as SheetData;
  });
  if (!out) throw new Error("Stream ended without data");
  return out;
}

export function traceDown(file_id: string, sheet: string, cell: string) {
  return readJson<TraceNode>(`${API}/api/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, sheet, cell }),
  });
}

export function traceUp(file_id: string, sheet: string, cell: string) {
  return readJson<TraceNode>(`${API}/api/trace-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, sheet, cell }),
  });
}

export function fetchTables(fid: string, sheet: string) {
  return readJson<TableRegion[]>(`${API}/api/tables/${fid}/${encodeURIComponent(sheet)}`);
}

export function saveTables(fid: string, sheet: string, tables: TableRegion[]) {
  return readJson<{ ok: boolean }>(`${API}/api/tables/${fid}/${encodeURIComponent(sheet)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tables }),
  });
}

export function fetchTableTrace(file_id: string, sheet: string, range: string) {
  return readJson<TableTraceResult>(`${API}/api/table-trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, sheet, range }),
  });
}

export async function streamExplanation(trace: TraceNode, onText: (text: string) => void, model?: string) {
  const res = await fetch(`${API}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trace, model }),
  });
  let usage: Record<string, unknown> | null = null;
  await parseSse(res, (event) => {
    if (event.text) onText(String(event.text));
    if (event.done) usage = event.usage as Record<string, unknown>;
  });
  return usage;
}

export async function streamBusinessSummary(trace: TraceNode, onText: (text: string) => void, model?: string) {
  const res = await fetch(`${API}/api/business-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trace, model }),
  });
  await parseSse(res, (event) => {
    if (event.text) onText(String(event.text));
  });
}

export async function streamBatchExplain(
  metrics: { label: string; trace: TraceNode }[],
  onEvent: (event: Record<string, unknown>) => void,
  model?: string,
) {
  const res = await fetch(`${API}/api/table-explain-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics, model }),
  });
  return parseSse(res, onEvent);
}

export async function streamOptimize(
  trace: TraceNode,
  label: string,
  onEvent: (event: Record<string, unknown>) => void,
  model?: string,
) {
  const res = await fetch(`${API}/api/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trace, label, model }),
  });
  return parseSse(res, onEvent);
}

export function fetchTopMetrics(fileId: string, sheets: string[], minDepth: number) {
  const params = new URLSearchParams();
  if (sheets.length) params.set("sheets", sheets.join(","));
  params.set("min_depth", String(minDepth));
  return readJson<{ metrics: TopMetric[]; total: number }>(`${API}/api/top-metrics/${fileId}?${params.toString()}`);
}

export function fetchTopMetricTrace(fileId: string, sheet: string, cell: string) {
  return readJson<TopMetricDetail>(`${API}/api/top-metrics/${fileId}/trace/${encodeURIComponent(sheet)}/${cell}`, {
    method: "POST",
  });
}

export async function streamTopMetricExplanations(
  metrics: { trace: TraceNode }[],
  onEvent: (event: Record<string, unknown>) => void,
  model?: string,
) {
  const res = await fetch(`${API}/api/top-metrics/explain-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics, model }),
  });
  return parseSse(res, onEvent);
}
