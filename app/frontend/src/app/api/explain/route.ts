export const runtime = "nodejs";
import { sseStream, jsonError, saveExplanation, getExplanation } from "@/lib/server/storage";
import { streamExplain } from "@/lib/server/llm";
import type { TraceNode } from "@/lib/server/excel";
import { addMetaToTrace } from "@/lib/server/excel";
import { readWorkbook } from "@/lib/server/storage";

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

  // Check explanation cache unless regenerating
  if (!regenerate && file_id && sheet && cell) {
    const cached = getExplanation(file_id, sheet, cell, "analyst");
    if (cached) {
      return Response.json({ cached: true, text: cached, task_id: null });
    }
  }

  // Enrich trace with meta labels if workbook is available
  let enriched = trace;
  if (file_id) {
    const wb = readWorkbook(file_id);
    if (wb) enriched = addMetaToTrace(wb, trace);
  }

  return sseStream(async (enqueue) => {
    let full = "";
    for await (const chunk of streamExplain(enriched)) {
      full += chunk;
      enqueue({ text: chunk });
    }
    if (file_id && sheet && cell && full) {
      saveExplanation(file_id, sheet, cell, "analyst", full);
    }
    enqueue({ done: true });
  });
}
