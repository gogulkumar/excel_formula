export const runtime = "nodejs";

import { sseStream, jsonError } from "@/lib/server/storage";
import { streamExplain, streamBusinessSummary } from "@/lib/server/llm";
import type { TraceNode } from "@/lib/server/excel";

export async function POST(request: Request) {
  const body = await request.json() as { metrics: Array<{ label: string; trace: TraceNode }> };
  const { metrics } = body;
  if (!Array.isArray(metrics)) return jsonError("metrics is required");

  return sseStream(async (enqueue) => {
    for (let index = 0; index < metrics.length; index += 1) {
      const metric = metrics[index];
      enqueue({ metric_index: index, type: "analyst", status: "start" });
      for await (const chunk of streamExplain(metric.trace)) {
        enqueue({ metric_index: index, type: "analyst", text: chunk });
      }
      enqueue({ metric_index: index, type: "analyst", status: "done" });

      enqueue({ metric_index: index, type: "business", status: "start" });
      for await (const chunk of streamBusinessSummary(metric.trace)) {
        enqueue({ metric_index: index, type: "business", text: chunk });
      }
      enqueue({ metric_index: index, type: "business", status: "done" });
    }
    enqueue({ all_done: true });
  });
}
