export const runtime = "nodejs";
import { readWorkbook, notFound } from "@/lib/server/storage";
import { getTopMetrics } from "@/lib/server/excel";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const url = new URL(request.url);
  const sheetsParam = url.searchParams.get("sheets") ?? "";
  const minRefs = parseInt(url.searchParams.get("min_refs") ?? "2");

  const wb = readWorkbook(fileId);
  if (!wb) return notFound("File not found");

  const sheetList = sheetsParam
    ? sheetsParam.split(",").filter((s) => wb.SheetNames.includes(s))
    : wb.SheetNames;

  const metrics = getTopMetrics(wb, sheetList, isNaN(minRefs) ? 2 : minRefs);
  return Response.json({ metrics, total: metrics.length });
}
