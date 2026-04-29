export const runtime = "nodejs";
import { readWorkbookBuffer, getFile, notFound } from "@/lib/server/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const entry = getFile(fileId);
  if (!entry) return notFound("File not found");

  const buf = readWorkbookBuffer(fileId);
  if (!buf) return notFound("File data not found");

  return new Response(buf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${entry.filename}"`,
      "Content-Length": String(buf.length),
    },
  });
}
