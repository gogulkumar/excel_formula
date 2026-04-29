export const runtime = "nodejs";
import { readWorkbook, jsonError, notFound } from "@/lib/server/storage";
import { extractTableMetrics } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as { file_id: string; sheet: string; range: string; max_depth?: number };
  const { file_id, sheet, range, max_depth = 5 } = body;

  if (!file_id || !sheet || !range) return jsonError("file_id, sheet, and range are required");

  const wb = readWorkbook(file_id);
  if (!wb) return notFound("File not found");

  const metrics = extractTableMetrics(wb, sheet, range, Math.min(max_depth, 6));
  return Response.json({ metrics });
}
