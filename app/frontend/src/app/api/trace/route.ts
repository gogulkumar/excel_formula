export const runtime = "nodejs";
import { readWorkbook, jsonError, notFound } from "@/lib/server/storage";
import { traceNode, addMetaToTrace } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as { file_id: string; sheet: string; cell: string; max_depth?: number };
  const { file_id, sheet, cell, max_depth = 5 } = body;

  if (!file_id || !sheet || !cell) return jsonError("file_id, sheet, and cell are required");

  const wb = readWorkbook(file_id);
  if (!wb) return notFound("File not found");
  if (!wb.SheetNames.includes(sheet)) return notFound("Sheet not found");

  const raw = traceNode(wb, sheet, cell.toUpperCase(), new Set(), 0, Math.min(max_depth, 8));
  const trace_tree = addMetaToTrace(wb, raw);
  return Response.json({ trace_tree });
}
