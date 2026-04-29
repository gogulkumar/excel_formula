export const runtime = "nodejs";
import { readWorkbook, sseStream, notFound } from "@/lib/server/storage";
import { getSheetData } from "@/lib/server/excel";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string; sheet: string }> },
) {
  return sseStream(async (enqueue) => {
    const { fileId, sheet } = await params;
    const sheetName = decodeURIComponent(sheet);

    enqueue({ progress: "Loading workbook…" });

    const wb = readWorkbook(fileId);
    if (!wb) { enqueue({ error: "File not found" }); return; }
    if (!wb.SheetNames.includes(sheetName)) { enqueue({ error: "Sheet not found" }); return; }

    enqueue({ progress: "Reading cells…" });
    const data = getSheetData(wb, sheetName);
    enqueue({ progress: `Loaded ${data.rows.length} rows`, done: true, data });
  });
}
