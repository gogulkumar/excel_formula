export const runtime = "nodejs";
import { notFound } from "@/lib/server/storage";
import { getFile } from "@/lib/server/storage";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const entry = getFile(fileId);
  if (!entry) return notFound("File not found");
  // Caches are disk-based — just returning ok is enough
  return Response.json({ ok: true, cleared: 0 });
}
