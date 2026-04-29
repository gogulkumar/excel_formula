export const runtime = "nodejs";
import { sseStream, jsonError, readWorkbook } from "@/lib/server/storage";
import { streamSnapshot } from "@/lib/server/llm";
import { addMetaToTrace } from "@/lib/server/excel";
import type { TraceNode } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as { trace: TraceNode; file_id?: string };
  const { trace, file_id } = body;
  if (!trace) return jsonError("trace is required");

  let enriched = trace;
  if (file_id) {
    const wb = readWorkbook(file_id);
    if (wb) enriched = addMetaToTrace(wb, trace);
  }

  return sseStream(async (enqueue) => {
    for await (const chunk of streamSnapshot(enriched)) {
      enqueue({ text: chunk });
    }
    enqueue({ done: true });
  });
}
