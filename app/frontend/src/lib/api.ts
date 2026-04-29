import { API } from "@/lib/constants";
import type {
  BackendStatus,
  FileEntry,
  IndexingProgress,
  OptimizeResult,
  SheetData,
  TableRegion,
  TableTraceResult,
  TaskStartResponse,
  TopMetric,
  TopMetricDetail,
  TraceNode,
} from "@/lib/types";

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

async function parseSse(
  res: Response,
  onEvent: (event: Record<string, unknown>) => void,
) {
  if (!res.ok) {
    throw new Error(await res.text());
  }
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

export function fetchBackendStatus() {
  return readJson<BackendStatus>(`${API}/api/status`);
}

export function fetchRegistry() {
  return readJson<FileEntry[]>(`${API}/api/files`);
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

export function reloadWorkbook(fid: string, sheet?: string) {
  const suffix = sheet ? `?sheet=${encodeURIComponent(sheet)}` : "";
  return readJson<{ ok: boolean; cleared: number }>(`${API}/api/reload/${fid}${suffix}`, { method: "POST" });
}

export async function traceDown(file_id: string, sheet: string, cell: string, maxDepth = 5) {
  const res = await readJson<{ trace_tree: TraceNode }>(`${API}/api/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, sheet, cell, max_depth: maxDepth }),
  });
  return res.trace_tree;
}

export async function traceUp(file_id: string, sheet: string, cell: string, maxDepth = 5) {
  const res = await readJson<{ trace_tree: TraceNode }>(`${API}/api/trace-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, sheet, cell, max_depth: maxDepth }),
  });
  return res.trace_tree;
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

export function fetchTableTrace(file_id: string, sheet: string, range: string, maxDepth = 5) {
  return readJson<TableTraceResult>(`${API}/api/table-trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, sheet, range, max_depth: maxDepth }),
  });
}

export function fetchCachedExplanations(fid: string, sheet: string, cell: string) {
  return readJson<{ analyst: string; business: string }>(
    `${API}/api/explanations/${fid}/${encodeURIComponent(sheet)}/${cell}`,
  );
}

export function connectToTaskStream(
  taskId: string,
  offset: number,
  onEvent: (event: Record<string, unknown>) => void,
) {
  return fetch(`${API}/api/task/${taskId}/stream?offset=${offset}`).then((res) => parseSse(res, onEvent));
}

export function cancelTask(taskId: string) {
  return readJson<{ status: string }>(`${API}/api/task/${taskId}/cancel`, { method: "POST" });
}

async function startTaskAndStream(
  endpoint: string,
  body: Record<string, unknown>,
  onText: (text: string) => void,
  onError?: (error: string) => void,
) {
  const res = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // New Next.js API routes stream SSE directly
  if (res.headers.get("content-type")?.startsWith("text/event-stream")) {
    await parseSse(res, (event) => {
      if (event.text) onText(String(event.text));
      if (event.error) onError?.(String(event.error));
    });
    return { cached: false, taskId: null as string | null };
  }

  // Legacy Python backend: returns {task_id} or {cached, text}
  if (!res.ok) throw new Error(await res.text());
  const started = (await res.json()) as TaskStartResponse;
  if (started.cached && started.text) {
    onText(started.text);
    return { cached: true, taskId: null as string | null };
  }
  if (!started.task_id) throw new Error("Task did not start");
  await connectToTaskStream(started.task_id, 0, (event) => {
    if (event.text) onText(String(event.text));
    if (event.error) onError?.(String(event.error));
  });
  return { cached: false, taskId: started.task_id };
}

export function streamExplanation(
  trace: TraceNode,
  onText: (text: string) => void,
  model?: string,
  cacheInfo?: { file_id: string; sheet: string; cell: string },
  regenerate = false,
) {
  return startTaskAndStream(
    "/api/explain",
    { trace, model, regenerate, ...(cacheInfo || {}) },
    onText,
  );
}

export function streamBusinessSummary(
  trace: TraceNode,
  onText: (text: string) => void,
  model?: string,
  cacheInfo?: { file_id: string; sheet: string; cell: string },
  regenerate = false,
) {
  return startTaskAndStream(
    "/api/business-summary",
    { trace, model, regenerate, ...(cacheInfo || {}) },
    onText,
  );
}

export function streamReconstruction(
  trace: TraceNode,
  onText: (text: string) => void,
  model?: string,
  cacheInfo?: { file_id: string; sheet: string; cell: string },
  regenerate = false,
) {
  return startTaskAndStream(
    "/api/reconstruct",
    { trace, model, regenerate, ...(cacheInfo || {}) },
    onText,
  );
}

export function streamSnapshot(
  trace: TraceNode,
  onText: (text: string) => void,
  model?: string,
  cacheInfo?: { file_id: string; sheet: string; cell: string },
  regenerate = false,
) {
  return startTaskAndStream(
    "/api/snapshot",
    { trace, model, regenerate, ...(cacheInfo || {}) },
    onText,
  );
}

export function streamWorkbookOverview(
  fileId: string,
  onText: (text: string) => void,
  opts?: {
    sheet?: string;
    focus_cells?: string[];
    model?: string;
    regenerate?: boolean;
  },
) {
  return startTaskAndStream(
    "/api/workbook-overview",
    {
      file_id: fileId,
      sheet: opts?.sheet || "",
      focus_cells: opts?.focus_cells || [],
      model: opts?.model,
      regenerate: opts?.regenerate ?? false,
    },
    onText,
  );
}

export function streamWorkbookHealth(
  fileId: string,
  onText: (text: string) => void,
  opts?: {
    sheet?: string;
    model?: string;
    regenerate?: boolean;
  },
) {
  return startTaskAndStream(
    "/api/workbook-health",
    {
      file_id: fileId,
      sheet: opts?.sheet || "",
      model: opts?.model,
      regenerate: opts?.regenerate ?? false,
    },
    onText,
  );
}

export function streamDriverRanking(
  trace: TraceNode,
  onText: (text: string) => void,
  model?: string,
  cacheInfo?: { file_id: string; sheet: string; cell: string },
  regenerate = false,
) {
  return startTaskAndStream(
    "/api/driver-ranking",
    { trace, model, regenerate, ...(cacheInfo || {}) },
    onText,
  );
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

export function fetchTopMetrics(fileId: string, sheets: string[], minRefs: number) {
  const params = new URLSearchParams();
  if (sheets.length) params.set("sheets", sheets.join(","));
  params.set("min_refs", String(minRefs));
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
  regenerate = false,
) {
  const res = await fetch(`${API}/api/top-metrics/explain-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics, model, regenerate }),
  });
  return parseSse(res, onEvent);
}

export function editCells(fid: string, sheet: string, edits: Array<{ cell: string; value?: unknown; formula?: string | null }>) {
  return readJson<{ ok: boolean; results: Array<{ cell: string; status: string }> }>(`${API}/api/edit-cells`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fid, sheet, edits }),
  });
}

export function formatCells(fid: string, sheet: string, cells: string[], format: Record<string, unknown>) {
  return readJson<{ ok: boolean; cells_updated: number }>(`${API}/api/format-cells`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fid, sheet, cells, format }),
  });
}

export function insertChart(fid: string, sheet: string, chartSpec: Record<string, unknown>, nearRange?: string) {
  return readJson<{ ok: boolean; data_range: string; chart_anchor: string }>(`${API}/api/insert-chart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fid, sheet, chart_spec: chartSpec, near_range: nearRange }),
  });
}

export function downloadWorkbookUrl(fid: string) {
  return `${API}/api/download/${fid}`;
}

export async function streamChat(
  fileId: string,
  message: string,
  onEvent: (event: Record<string, unknown>) => void,
  opts?: {
    sheet?: string;
    selected_tables?: string[];
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    model?: string;
    mode?: string;
    focus_cells?: string[];
  },
) {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_id: fileId,
      message,
      sheet: opts?.sheet || "",
      selected_tables: opts?.selected_tables || [],
      history: opts?.history || [],
      model: opts?.model,
      mode: opts?.mode || "auto",
      focus_cells: opts?.focus_cells || [],
    }),
  });
  return parseSse(res, onEvent);
}
