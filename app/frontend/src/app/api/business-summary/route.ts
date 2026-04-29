export const runtime = "nodejs";
import { sseStream, jsonError, saveExplanation, getExplanation, readWorkbook } from "@/lib/server/storage";
import { streamBusinessSummary } from "@/lib/server/llm";
import { addMetaToTrace } from "@/lib/server/excel";
import type { TraceNode } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as {
    trace: TraceNode;
    file_id?: string;
    sheet?: string;
    cell?: string;
    regenerate?: boolean;
  };
  const { trace, file_id, sheet, cell, regenerate } = body;
  if (!trace) return jsonError("trace is required");

  if (!regenerate && file_id && sheet && cell) {
    const cached = getExplanation(file_id, sheet, cell, "business");
    if (cached) return Response.json({ cached: true, text: cached, task_id: null });
  }

  let enriched = trace;
  if (file_id) {
    const wb = readWorkbook(file_id);
    if (wb) enriched = addMetaToTrace(wb, trace);
  }

  return sseStream(async (enqueue) => {
    let full = "";
    for await (const chunk of streamBusinessSummary(enriched)) {
      full += chunk;
      enqueue({ text: chunk });
    }
    if (file_id && sheet && cell && full) {
      saveExplanation(file_id, sheet, cell, "business", full);
    }
    enqueue({ done: true });
  });
}
