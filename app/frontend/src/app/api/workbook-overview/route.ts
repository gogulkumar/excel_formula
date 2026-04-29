export const runtime = "nodejs";

import { readWorkbook, jsonError, notFound, sseStream } from "@/lib/server/storage";
import { buildWorkbookContext, streamChat } from "@/lib/server/llm";

export async function POST(request: Request) {
  const body = await request.json() as {
    file_id: string;
    sheet?: string;
    focus_cells?: string[];
  };
  const { file_id, sheet = "", focus_cells = [] } = body;
  if (!file_id) return jsonError("file_id is required");

  const wb = readWorkbook(file_id);
  if (!wb) return notFound("Workbook session not found. Re-upload the workbook and try again.");

  const context = buildWorkbookContext(wb, file_id, sheet, focus_cells);
  const prompt = "Give me a concise workbook overview. Summarize what this workbook appears to do, which sheets matter most, what the main outputs are, and what a finance user should inspect first.";

  return sseStream(async (enqueue) => {
    for await (const chunk of streamChat(context, prompt, [])) {
      enqueue({ text: chunk });
    }
    enqueue({ done: true });
  });
}
