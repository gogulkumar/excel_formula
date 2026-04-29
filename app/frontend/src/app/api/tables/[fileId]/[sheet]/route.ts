export const runtime = "nodejs";
import { readWorkbook, loadCachedTables, saveCachedTables, notFound, jsonError } from "@/lib/server/storage";
import { detectTables } from "@/lib/server/excel";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string; sheet: string }> },
) {
  const { fileId, sheet } = await params;
  const sheetName = decodeURIComponent(sheet);

  const cached = loadCachedTables(fileId, sheetName);
  if (cached) return Response.json(cached);

  const wb = readWorkbook(fileId);
  if (!wb) return notFound("File not found");
  if (!wb.SheetNames.includes(sheetName)) return notFound("Sheet not found");

  const tables = detectTables(wb, sheetName);
  saveCachedTables(fileId, sheetName, tables);
  return Response.json(tables);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ fileId: string; sheet: string }> },
) {
  const { fileId, sheet } = await params;
  const sheetName = decodeURIComponent(sheet);
  const body = await request.json() as { tables: unknown[] };
  saveCachedTables(fileId, sheetName, body.tables as never);
  return Response.json({ ok: true });
}
