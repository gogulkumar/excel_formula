export const runtime = "nodejs";

import { jsonError, sseStream } from "@/lib/server/storage";
import type { TraceNode } from "@/lib/server/excel";
import { traceToText } from "@/lib/server/excel";
import { streamChat } from "@/lib/server/llm";

export async function POST(request: Request) {
  const body = await request.json() as { trace: TraceNode; label?: string };
  const { trace, label = "" } = body;
  if (!trace) return jsonError("trace is required");

  const prompt = [
    "Review this dependency tree for optimization opportunities.",
    "Call out redundant pass-through logic, flattenable hops, and unnecessary complexity.",
    "If there is no obvious simplification, say to keep it as-is.",
    "",
    `Metric: ${label || `${trace.sheet}!${trace.cell}`}`,
    "",
    traceToText(trace),
  ].join("\n");

  return sseStream(async (enqueue) => {
    let full = "";
    for await (const chunk of streamChat("Use only the dependency tree below.", prompt, [])) {
      full += chunk;
      enqueue({ text: chunk });
    }
    enqueue({
      result: {
        verdict: /keep as-is|keep as is|no obvious simplification|no changes needed/i.test(full) ? "keep" : "optimize",
        reason: full,
      },
    });
    enqueue({ done: true });
  });
}
