export const runtime = "nodejs";

import { sseStream, jsonError } from "@/lib/server/storage";
import { streamExplain, streamBusinessSummary, streamReconstruction } from "@/lib/server/llm";
import type { TraceNode } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as { metrics: Array<{ trace: TraceNode }> };
  const { metrics } = body;
  if (!Array.isArray(metrics)) return jsonError("metrics is required");

  return sseStream(async (enqueue) => {
    for (let index = 0; index < metrics.length; index += 1) {
      const trace = metrics[index]?.trace;
      if (!trace) continue;

      enqueue({ metric_index: index, type: "analyst", status: "start" });
      for await (const chunk of streamExplain(trace)) {
        enqueue({ metric_index: index, type: "analyst", text: chunk });
      }
      enqueue({ metric_index: index, type: "analyst", status: "done" });

      enqueue({ metric_index: index, type: "business", status: "start" });
      for await (const chunk of streamBusinessSummary(trace)) {
        enqueue({ metric_index: index, type: "business", text: chunk });
      }
      enqueue({ metric_index: index, type: "business", status: "done" });

      enqueue({ metric_index: index, type: "blueprint", status: "start" });
      for await (const chunk of streamReconstruction(trace)) {
        enqueue({ metric_index: index, type: "blueprint", text: chunk });
      }
      enqueue({ metric_index: index, type: "blueprint", status: "done" });
    }
    enqueue({ all_done: true });
  });
}
