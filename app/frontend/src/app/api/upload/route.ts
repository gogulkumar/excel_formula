export const runtime = "nodejs";
import { saveUploadedFile, sseStream, jsonError } from "@/lib/server/storage";

export async function POST(request: Request) {
  return sseStream(async (enqueue) => {
    enqueue({ progress: "Receiving file…" });

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      enqueue({ error: "Could not parse form data" });
      return;
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      enqueue({ error: "No file provided" });
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      enqueue({ error: "Only .xlsx files are supported" });
      return;
    }

    if (file.size > 200_000_000) {
      enqueue({ error: "File exceeds 200 MB limit" });
      return;
    }

    enqueue({ progress: "Parsing workbook…" });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Quick magic-byte check
    if (!buffer.slice(0, 2).equals(Buffer.from([0x50, 0x4b]))) {
      enqueue({ error: "File does not appear to be a valid .xlsx (ZIP) file" });
      return;
    }

    enqueue({ progress: "Indexing sheets…" });

    let result: Awaited<ReturnType<typeof saveUploadedFile>>;
    try {
      result = await saveUploadedFile(buffer, file.name);
    } catch (err) {
      enqueue({ error: `Failed to process workbook: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    const { fileId, entry } = result;

    enqueue({ progress: `Loaded ${entry.sheets.length} sheets` });
    enqueue({
      done: true,
      file_id: fileId,
      filename: entry.filename,
      sheets: entry.sheets,
    });
  });
}
