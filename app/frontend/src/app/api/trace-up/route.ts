export const runtime = "nodejs";
import { readWorkbook, jsonError, notFound } from "@/lib/server/storage";
import { buildRefIndex, traceUp, addMetaToTrace } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as { file_id: string; sheet: string; cell: string; max_depth?: number };
  const { file_id, sheet, cell } = body;

  if (!file_id || !sheet || !cell) return jsonError("file_id, sheet, and cell are required");

  const wb = readWorkbook(file_id);
  if (!wb) return notFound("File not found");

  const index = buildRefIndex(wb);
  const raw = traceUp(wb, file_id, sheet, cell.toUpperCase(), index, new Set());
  const trace_tree = addMetaToTrace(wb, raw);
  return Response.json({ trace_tree });
}
