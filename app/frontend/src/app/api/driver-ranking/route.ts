export const runtime = "nodejs";

import { jsonError, sseStream } from "@/lib/server/storage";
import { streamChat } from "@/lib/server/llm";
import type { TraceNode } from "@/lib/server/excel";
import { traceToText } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as {
    trace: TraceNode;
    file_id?: string;
    sheet?: string;
    cell?: string;
  };
  const { trace, sheet = "", cell = "" } = body;
  if (!trace) return jsonError("trace is required");

  const prompt = [
    "Rank the main drivers of this metric.",
    "Explain which dependencies matter most, which are likely direct drivers versus passthroughs, and what a finance user should inspect first.",
    "Use a ranked list and keep it grounded in the dependency tree.",
    "",
    `Metric: ${sheet && cell ? `${sheet}!${cell}` : `${trace.sheet}!${trace.cell}`}`,
    "",
    traceToText(trace),
  ].join("\n");

  return sseStream(async (enqueue) => {
    for await (const chunk of streamChat("Use only the dependency tree provided below.", prompt, [])) {
      enqueue({ text: chunk });
    }
    enqueue({ done: true });
  });
}
