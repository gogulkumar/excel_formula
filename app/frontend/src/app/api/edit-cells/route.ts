export const runtime = "nodejs";
import { readWorkbook, saveWorkbook, jsonError, notFound, loadCachedTables, saveCachedTables } from "@/lib/server/storage";
import { applyCellEdits, detectTables } from "@/lib/server/excel";
import * as fs from "fs";

export async function POST(request: Request) {
  const body = await request.json() as {
    file_id: string;
    sheet: string;
    edits: Array<{ cell: string; value?: unknown; formula?: string | null }>;
  };
  const { file_id, sheet, edits } = body;
  if (!file_id || !sheet || !edits) return jsonError("file_id, sheet, and edits are required");

  const wb = readWorkbook(file_id);
  if (!wb) return notFound("File not found");
  if (!wb.SheetNames.includes(sheet)) return notFound("Sheet not found");

  applyCellEdits(wb, sheet, edits);
  saveWorkbook(file_id, wb);

  return Response.json({
    ok: true,
    results: edits.map((e) => ({ cell: e.cell, status: "ok" })),
  });
}
