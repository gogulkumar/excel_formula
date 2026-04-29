export const runtime = "nodejs";
import { sseStream, jsonError, readWorkbook } from "@/lib/server/storage";
import { streamChat, buildWorkbookContext } from "@/lib/server/llm";

export async function POST(request: Request) {
  const body = await request.json() as {
    file_id: string;
    message: string;
    sheet?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    focus_cells?: string[];
  };
  const { file_id, message, sheet, history = [], focus_cells = [] } = body;
  if (!file_id || !message) return jsonError("file_id and message are required");

  const wb = readWorkbook(file_id);

  const context = wb
    ? buildWorkbookContext(wb, file_id, sheet, focus_cells)
    : "No workbook context available.";

  return sseStream(async (enqueue) => {
    for await (const chunk of streamChat(context, message, history)) {
      enqueue({ text: chunk });
    }
    enqueue({ done: true });
  });
}
