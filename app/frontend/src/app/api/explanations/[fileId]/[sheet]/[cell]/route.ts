export const runtime = "nodejs";
import { getExplanation } from "@/lib/server/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string; sheet: string; cell: string }> },
) {
  const { fileId, sheet, cell } = await params;
  const sheetName = decodeURIComponent(sheet);
  const cellRef = decodeURIComponent(cell).toUpperCase();

  return Response.json({
    analyst: getExplanation(fileId, sheetName, cellRef, "analyst") ?? "",
    business: getExplanation(fileId, sheetName, cellRef, "business") ?? "",
  });
}
