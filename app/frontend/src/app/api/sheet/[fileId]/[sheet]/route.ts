export const runtime = "nodejs";

import { getSheetData } from "@/lib/server/excel";
import { notFound, readWorkbook } from "@/lib/server/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string; sheet: string }> },
) {
  const { fileId, sheet } = await params;
  const wb = readWorkbook(fileId);
  if (!wb) return notFound("Workbook session not found. Re-upload the workbook and try again.");
  return Response.json(getSheetData(wb, decodeURIComponent(sheet)));
}
