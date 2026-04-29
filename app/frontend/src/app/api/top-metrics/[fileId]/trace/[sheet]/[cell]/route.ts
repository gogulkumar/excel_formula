export const runtime = "nodejs";
import { readWorkbook, notFound } from "@/lib/server/storage";
import { traceNode, addMetaToTrace, getTopMetrics } from "@/lib/server/excel";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ fileId: string; sheet: string; cell: string }> },
) {
  const { fileId, sheet, cell } = await params;
  const sheetName = decodeURIComponent(sheet);
  const cellRef = decodeURIComponent(cell).toUpperCase();

  const wb = readWorkbook(fileId);
  if (!wb) return notFound("File not found");

  const trace = addMetaToTrace(wb, traceNode(wb, sheetName, cellRef, new Set(), 0, 5));

  // Also get the top metrics list so the frontend can display all of them
  const allMetrics = getTopMetrics(wb, wb.SheetNames, 1);
  const metricMeta = allMetrics.find((m) => m.sheet === sheetName && m.cell === cellRef);

  return Response.json({
    trace,
    label: metricMeta?.label ?? `${sheetName}!${cellRef}`,
    value: metricMeta?.value ?? trace.value,
    formula: trace.formula ?? "",
    ref_count: metricMeta?.ref_count ?? 0,
  });
}
