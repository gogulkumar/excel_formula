export const runtime = "nodejs";
import { getFile, deleteFile } from "@/lib/server/storage";
import { notFound } from "@/lib/server/storage";

export function GET(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  return params.then(({ fileId }) => {
    const entry = getFile(fileId);
    if (!entry) return notFound("File not found");
    return Response.json(entry);
  });
}

export function DELETE(_req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  return params.then(({ fileId }) => {
    const ok = deleteFile(fileId);
    return Response.json({ ok });
  });
}
