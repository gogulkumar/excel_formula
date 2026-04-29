export const runtime = "nodejs";
import { readWorkbook, saveWorkbook, jsonError, notFound } from "@/lib/server/storage";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const body = await request.json() as {
    file_id: string;
    sheet: string;
    cells: string[];
    format: {
      fill?: string | null;
      font_color?: string | null;
      bold?: boolean | null;
      italic?: boolean | null;
      number_format?: string | null;
    };
  };
  const { file_id, sheet, cells, format } = body;
  if (!file_id || !sheet || !cells) return jsonError("file_id, sheet, and cells are required");

  const wb = readWorkbook(file_id);
  if (!wb) return notFound("File not found");
  const ws = wb.Sheets[sheet];
  if (!ws) return notFound("Sheet not found");

  for (const cellRef of cells) {
    const cell = ws[cellRef] as XLSX.CellObject | undefined;
    if (!cell) continue;
    const s = ((cell as unknown as { s?: Record<string, unknown> }).s ?? {}) as Record<string, unknown>;
    if (format.fill !== undefined && format.fill !== null) {
      s.fgColor = { rgb: format.fill.replace("#", "") };
    }
    if (format.font_color !== undefined && format.font_color !== null) {
      s.color = { rgb: format.font_color.replace("#", "") };
    }
    if (format.bold !== undefined && format.bold !== null) s.bold = format.bold;
    if (format.italic !== undefined && format.italic !== null) s.italic = format.italic;
    if (format.number_format !== undefined && format.number_format !== null) s.numFmt = format.number_format;
    (cell as unknown as { s: Record<string, unknown> }).s = s;
  }

  saveWorkbook(file_id, wb);
  return Response.json({ ok: true, cells_updated: cells.length });
}
