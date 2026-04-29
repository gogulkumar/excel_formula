/**
 * LLM streaming via OpenAI-compatible chat completions.
 * Used by the optional Next.js API route layer when enabled.
 */
import type { TraceNode } from "./excel";
import { traceToText } from "./excel";

const MODEL = process.env.CALCSENSE_MODEL ?? "gpt-4.1";
const MAX_TOKENS = 2048;

function getBaseUrl() {
  return (
    process.env.OPENAI_BASE_URL ||
    process.env.OPENAI_API_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
}

function getApiKey() {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.EFT_PROXY_API_KEY ||
    process.env.test_apikey ||
    ""
  );
}

const EXPLAIN_SYSTEM = `You are a finance analyst documenting how a metric is constructed. Your output will be stored as a permanent reference for other analysts.

You will receive the full dependency tree. Each node has: cell reference, sheet name, formula (if any), computed value, and contextual metadata (row label, column header). Use metadata labels instead of raw cell addresses whenever available.

Your goal: explain the logic and transformations at each level of the formula so an analyst understands the methodology without opening the spreadsheet.

Do not include numbers, computed values, or worked examples.

Respond in exactly two sections separated by this exact line:
---FORMULA---

Before the separator, provide a metric identity paragraph and a methodology breakdown using nested bullets. After the separator, provide a compact formula definition using metric names.`;

const BUSINESS_SYSTEM = `You are a finance executive advisor. Explain metrics in plain business English with no spreadsheet jargon, no cell references, and no numbers.

Respond in exactly three sections:
## What is this metric?
## How is it calculated?
## Base inputs`;

const RECONSTRUCT_SYSTEM = `You are a senior spreadsheet architect.

You will receive a metric dependency tree. Reconstruct how the formula is built in a way that helps another analyst rebuild it from scratch and review whether the structure can be simplified.

Respond in exactly three sections separated by these delimiters:
---BLUEPRINT_STEPS---
---BLUEPRINT_OPTIMIZE---`;

const SNAPSHOT_SYSTEM = `You are generating a compact snapshot of a spreadsheet metric.

Respond in exactly three segments separated by:
---SNAP---`;

const CHAT_SYSTEM = `You are CalcSense, an AI workbook copilot.

Your job is to help users understand, review, summarize, visualize, and improve spreadsheet models using only the workbook context you are given.

Rules:
- Stay focused on workbook analysis.
- Refuse off-topic requests briefly and redirect back to workbook help.
- Do not invent workbook values, formulas, or sheet names.
- When referring to a metric for the first time, prefer: **Metric Name** (\`Sheet!Cell\`) when available.
- Be concise, useful, and action-oriented.

Allowed output modes:
- Plain text explanations
- \`\`\`chart fenced JSON blocks
- \`\`\`edit fenced JSON blocks`;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function* parseOpenAiStream(response: Response): AsyncGenerator<string> {
  if (!response.ok) {
    throw new Error(await response.text());
  }
  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const lines = event.split("\n").filter((line) => line.startsWith("data: "));
      for (const line of lines) {
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const text = json.choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    }
  }
}

async function* streamCompletion(system: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  yield* parseOpenAiStream(response);
}

export function streamExplain(trace: TraceNode): AsyncGenerator<string> {
  const label = trace.meta ?? `${trace.sheet}!${trace.cell}`;
  const text = traceToText(trace);
  return streamCompletion(EXPLAIN_SYSTEM, [
    { role: "user", content: `Here is the full dependency tree for the metric '${label}':\n\n${text}\n\nPlease explain this formula in plain English.` },
  ]);
}

export function streamBusinessSummary(trace: TraceNode): AsyncGenerator<string> {
  const label = trace.meta ?? `${trace.sheet}!${trace.cell}`;
  const text = traceToText(trace);
  return streamCompletion(BUSINESS_SYSTEM, [
    { role: "user", content: `Summarise this metric for an executive audience.\n\nMetric: ${label}\n\nDependency tree:\n${text}` },
  ]);
}

export function streamReconstruction(trace: TraceNode): AsyncGenerator<string> {
  const label = trace.meta ?? `${trace.sheet}!${trace.cell}`;
  const text = traceToText(trace);
  return streamCompletion(RECONSTRUCT_SYSTEM, [
    { role: "user", content: `Reconstruct and analyse this formula.\n\nMetric: ${label}\n\nDependency tree:\n${text}` },
  ]);
}

export function streamSnapshot(trace: TraceNode): AsyncGenerator<string> {
  const text = traceToText(trace);
  return streamCompletion(SNAPSHOT_SYSTEM, [
    { role: "user", content: `Generate a compact snapshot for this metric.\n\nDependency tree:\n${text}` },
  ]);
}

export async function* streamChat(
  workbookContext: string,
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): AsyncGenerator<string> {
  const systemWithContext = `${CHAT_SYSTEM}\n\n---\nWORKBOOK CONTEXT\n---\n${workbookContext}`;
  yield* streamCompletion(
    systemWithContext,
    [
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: message },
    ],
  );
}

export function buildWorkbookContext(
  wb: { SheetNames: string[]; Sheets: Record<string, unknown> },
  filename: string,
  focusSheet?: string,
  focusCells?: string[],
): string {
  const lines: string[] = [
    `Workbook: ${filename}`,
    `Sheets (${wb.SheetNames.length}): ${wb.SheetNames.join(", ")}`,
  ];

  if (focusSheet) lines.push(`Focus sheet: ${focusSheet}`);
  if (focusCells?.length) lines.push(`Focus cells: ${focusCells.join(", ")}`);

  lines.push("", "Use only workbook-grounded reasoning.");
  return lines.join("\n");
}
