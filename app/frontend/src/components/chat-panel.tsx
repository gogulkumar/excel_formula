"use client";

import { Fragment, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import {
  editCells,
  insertChart,
  streamChat,
  streamDriverRanking,
  streamWorkbookHealth,
  streamWorkbookOverview,
  traceDown,
} from "@/lib/api";
import type { TableRegion } from "@/lib/types";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type StatusStep = {
  text: string;
  time: number;
};

type ChartSpec = {
  type?: string;
  title?: string;
  x_axis?: string;
  y_axis?: string;
  series?: Array<{ name?: string; data?: Array<{ label: string; value: number }> }>;
};

type EditSpec = {
  edits: Array<{ cell: string; value?: unknown; formula?: string | null }>;
};

const MODE_META = {
  auto: { label: "Auto", icon: "✦", activeTone: "bg-text-primary text-white" },
  excel: { label: "Excel", icon: "ƒx", activeTone: "bg-accent text-white" },
  data: { label: "Data analyst", icon: "▥", activeTone: "bg-blue text-white" },
  business: { label: "Business", icon: "▣", activeTone: "bg-violet text-white" },
} as const;

const KIND_META = {
  visualize: "border-blue/20 bg-blue/5 text-blue",
  edit: "border-violet/20 bg-violet/5 text-violet",
  explore: "border-accent/20 bg-accent/5 text-accent",
  compute: "border-amber-200 bg-amber-50 text-amber-700",
} as const;

const CELL_REF_RE = /^(?:'([^']+)'!|([A-Za-z][\w .-]*?)!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?$/;

function parseJsonSafe<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractBlock(text: string, tag: string) {
  const match = text.match(new RegExp(String.raw`​\`\`\`${tag}\s*([\s\S]*?)\`\`\``, "i"));
  return match ? match[1].trim() : null;
}

function extractJsonBlock(text: string) {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  return matches.map((match) => match[1].trim());
}

function looksLikeChart(value: unknown): value is ChartSpec {
  return Boolean(value && typeof value === "object" && Array.isArray((value as ChartSpec).series));
}

function looksLikeEdit(value: unknown): value is EditSpec {
  return Boolean(value && typeof value === "object" && Array.isArray((value as EditSpec).edits));
}

function parseMessageBlocks(text: string) {
  const chartCandidates: string[] = [];
  const editCandidates: string[] = [];

  const chartBlock = extractBlock(text, "chart");
  if (chartBlock) chartCandidates.push(chartBlock);
  const editBlock = extractBlock(text, "edit");
  if (editBlock) editCandidates.push(editBlock);

  for (const jsonBlock of extractJsonBlock(text)) {
    chartCandidates.push(jsonBlock);
    editCandidates.push(jsonBlock);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    chartCandidates.push(trimmed);
    editCandidates.push(trimmed);
  }

  let chart: ChartSpec | null = null;
  for (const candidate of chartCandidates) {
    const parsed = parseJsonSafe<ChartSpec>(candidate);
    if (looksLikeChart(parsed)) {
      chart = parsed;
      break;
    }
  }

  let edit: EditSpec | null = null;
  for (const candidate of editCandidates) {
    const parsed = parseJsonSafe<EditSpec>(candidate);
    if (looksLikeEdit(parsed)) {
      edit = parsed;
      break;
    }
  }

  const cleaned = text
    .replace(/```chart[\s\S]*?```/gi, "")
    .replace(/```edit[\s\S]*?```/gi, "")
    .replace(/```json[\s\S]*?```/gi, (block) => {
      const payload = block.replace(/```json|```/gi, "").trim();
      const parsed = parseJsonSafe<ChartSpec | EditSpec>(payload);
      return looksLikeChart(parsed) || looksLikeEdit(parsed) ? "" : block;
    })
    .trim();

  return { chart, edit, text: cleaned };
}

function formatCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function scrollToCell(ref: string) {
  const target = document.getElementById(`cell-${ref.replace(/\$/g, "")}`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  if (target instanceof HTMLButtonElement) target.focus();
}

function CitationBadge({
  token,
  currentSheet,
}: {
  token: string;
  currentSheet: string;
}) {
  const match = CELL_REF_RE.exec(token);
  if (!match) return <code>{token}</code>;
  const sheetName = (match[1] || match[2] || "").trim();
  const start = match[3].replace(/\$/g, "");
  const end = match[4]?.replace(/\$/g, "");
  const sameSheet = !sheetName || sheetName === currentSheet;
  const label = sheetName ? `${sheetName}!${start}${end ? `:${end}` : ""}` : `${start}${end ? `:${end}` : ""}`;
  if (!sameSheet) {
    return <code className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs">{label}</code>;
  }
  return (
    <button
      type="button"
      onClick={() => scrollToCell(start)}
      className="rounded-full border border-blue/20 bg-blue/5 px-2 py-0.5 font-mono text-xs text-blue transition hover:border-blue hover:bg-blue/10"
    >
      {label}
    </button>
  );
}

function renderMessageText(text: string, currentSheet: string) {
  return (
    <div className="prose prose-sm max-w-none prose-p:leading-6 prose-pre:bg-bg-elevated prose-pre:p-4 prose-pre:rounded-2xl">
      <ReactMarkdown
        components={{
          code(props) {
            const { children, className, node, ref, ...rest } = props;
            const token = String(children).trim();
            if (!className && CELL_REF_RE.test(token)) {
              return <CitationBadge token={token} currentSheet={currentSheet} />;
            }
            return (
              <code className={className || "rounded-md bg-bg-elevated px-1.5 py-0.5 font-mono-ui text-xs"} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ContextChip({
  tone,
  label,
  onRemove,
}: {
  tone: "sheet" | "cell" | "table" | "active";
  label: string;
  onRemove?: () => void;
}) {
  const toneClass =
    tone === "sheet"
      ? "border-border-subtle bg-white text-text-secondary"
      : tone === "cell"
        ? "border-blue/20 bg-blue/5 text-blue"
        : tone === "table"
          ? "border-accent/20 bg-accent/5 text-accent"
          : "border-accent bg-accent text-white shadow-sm";
  return (
    <div className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${toneClass}`}>
      <span>{label}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="opacity-0 transition group-hover:opacity-100">
          ×
        </button>
      ) : null}
    </div>
  );
}

function SimpleChart({ spec }: { spec: ChartSpec }) {
  const palette = ["bg-accent", "bg-violet", "bg-blue", "bg-orange-500", "bg-pink-500", "bg-emerald-500", "bg-amber-500", "bg-indigo-500"];
  const series = Array.isArray(spec.series) ? spec.series : [];
  const first = series[0];
  const points = first?.data || [];
  const max = Math.max(1, ...points.map((point) => Math.abs(Number(point.value) || 0)));
  return (
    <div className="rounded-2xl border border-border-subtle bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{String(spec.title || "Chart preview")}</div>
          <div className="mt-1 text-xs text-text-tertiary">
            {spec.type || "bar"} {spec.y_axis ? `· ${spec.y_axis}` : ""}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {points.map((point, index) => {
          const value = Number(point.value) || 0;
          const width = `${Math.max(6, Math.round((Math.abs(value) / max) * 100))}%`;
          const tone = value < 0 ? "bg-rose" : palette[index % palette.length];
          return (
            <div key={`${point.label}-${index}`} className="grid grid-cols-[90px_1fr_56px] items-center gap-3 text-xs">
              <div className="truncate text-text-secondary">{point.label}</div>
              <div className="h-3 rounded-full bg-bg-elevated">
                <div className={`h-3 origin-left rounded-full animate-chart-bar-grow ${tone}`} style={{ width }} />
              </div>
              <div className="text-right font-mono-ui">{formatCompact(value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditPreview({
  edits,
  onApply,
}: {
  edits: EditSpec["edits"];
  onApply: () => Promise<void>;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-border-subtle bg-bg-elevated p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Suggested edits</div>
        <div className="text-xs text-text-tertiary">{edits.length} cells</div>
      </div>
      <div className="mt-3 space-y-2">
        {edits.map((edit) => (
          <div key={edit.cell} className="grid grid-cols-[72px_1fr] items-start gap-3 rounded-2xl bg-white px-3 py-2 text-sm">
            <div className="font-mono-ui text-text-secondary">{edit.cell}</div>
            <div className="text-text-secondary">
              {edit.formula != null ? (
                <code className="break-all font-mono-ui text-violet">{edit.formula}</code>
              ) : (
                <span>{JSON.stringify(edit.value)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <button className="mt-4 rounded-2xl bg-accent px-4 py-2 text-sm text-white" onClick={() => void onApply()}>
        Apply
      </button>
    </div>
  );
}

export function ChatPanel({
  fileId,
  sheet,
  selectedCell,
  tables,
  onClose,
  onRefresh,
}: {
  fileId: string;
  sheet: string;
  selectedCell?: string;
  tables: TableRegion[];
  onClose: () => void;
  onRefresh: () => Promise<void> | void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatMode, setChatMode] = useState<"auto" | "excel" | "data" | "business">("auto");
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [statusSteps, setStatusSteps] = useState<StatusStep[]>([]);
  const [activeStatus, setActiveStatus] = useState("");
  const [error, setError] = useState("");

  const activePromptHints = useMemo(() => {
    if (selectedCell) {
      return [
        { kind: "explore", text: `Explain ${selectedCell}` },
        { kind: "edit", text: `Rewrite ${selectedCell}` },
        { kind: "compute", text: `What drives ${selectedCell}?` },
        { kind: "visualize", text: "Create a chart for this metric" },
      ] as const;
    }
    if (tables.length > 1) {
      return [
        { kind: "visualize", text: "Chart the largest table" },
        { kind: "explore", text: "Find the key metrics" },
        { kind: "compute", text: "Which table has the strongest growth?" },
        { kind: "edit", text: "Add a growth column" },
      ] as const;
    }
    if (tables.length) {
      return [
        { kind: "visualize", text: "Chart the main table" },
        { kind: "explore", text: "Summarize this workbook" },
        { kind: "compute", text: "Find anomalies" },
        { kind: "edit", text: "Suggest cleanup edits" },
      ] as const;
    }
    return [
      { kind: "explore", text: "Explain the current sheet" },
      { kind: "compute", text: "Find anomalies" },
      { kind: "visualize", text: "Create a chart from the active data" },
      { kind: "edit", text: "Suggest edits to simplify the model" },
    ] as const;
  }, [selectedCell, tables.length]);

  async function submit(prompt = input) {
    const message = prompt.trim();
    if (!message || streaming) return;
    setError("");
    const history = [...messages, { role: "user" as const, text: message }];
    setMessages(history);
    setInput("");
    setStreaming(true);
    setStatusSteps([]);
    setActiveStatus("");
    let assistantText = "";
    setMessages((current) => [...current, { role: "assistant", text: "" }]);
    try {
      await streamChat(
        fileId,
        message,
        async (event) => {
          if (typeof event.status === "string") {
            const step = { text: event.status, time: Date.now() };
            setActiveStatus(step.text);
            setStatusSteps((current) => (current.some((item) => item.text === step.text) ? current : [...current, step]));
          }
          if (typeof event.text === "string") {
            assistantText += event.text;
            setMessages((current) => {
              const next = [...current];
              next[next.length - 1] = { role: "assistant", text: assistantText };
              return next;
            });
          }
          if (event.done) {
            setActiveStatus("");
          }
        },
        {
          sheet,
          mode: chatMode,
          focus_cells: selectedCell ? [selectedCell] : [],
          selected_tables: selectedTables.map((idx) => tables[idx]?.range).filter(Boolean),
          history: messages.map((item) => ({ role: item.role, content: item.text })),
        },
      );
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Chat failed.";
      setError(messageText);
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "assistant", text: `Error: ${messageText}` };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function runAssistantAction(
    label: string,
    runner: (push: (text: string) => void) => Promise<void>,
  ) {
    if (streaming) return;
    setError("");
    setStreaming(true);
    setActiveStatus(label);
    setStatusSteps([{ text: label, time: Date.now() }]);
    let assistantText = "";
    setMessages((current) => [...current, { role: "assistant", text: "" }]);
    try {
      await runner((text) => {
        assistantText += text;
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "assistant", text: assistantText };
          return next;
        });
      });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Assistant action failed.";
      setError(messageText);
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "assistant", text: `Error: ${messageText}` };
        return next;
      });
    } finally {
      setStreaming(false);
      setActiveStatus("");
    }
  }

  async function handleWorkbookOverview() {
    await runAssistantAction("Generating workbook overview", async (push) => {
      await streamWorkbookOverview(fileId, push, {
        sheet,
        focus_cells: selectedCell ? [selectedCell] : [],
        regenerate: true,
      });
    });
  }

  async function handleWorkbookHealth() {
    await runAssistantAction("Running workbook health scan", async (push) => {
      await streamWorkbookHealth(fileId, push, { sheet, regenerate: true });
    });
  }

  async function handleDriverRanking() {
    if (!selectedCell) {
      setError("Select a formula cell first to rank its drivers.");
      return;
    }
    await runAssistantAction(`Ranking drivers for ${selectedCell}`, async (push) => {
      const trace = await traceDown(fileId, sheet, selectedCell);
      await streamDriverRanking(
        trace,
        push,
        undefined,
        { file_id: fileId, sheet: trace.sheet, cell: trace.cell },
        true,
      );
    });
  }

  const lastAssistant = messages.filter((item) => item.role === "assistant").at(-1);
  const parsed = lastAssistant ? parseMessageBlocks(lastAssistant.text) : null;

  return (
    <aside className="animate-slide-in-right flex h-full flex-col rounded-[32px] border border-border-subtle bg-white">
      <div className="border-b border-border-subtle p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-text-tertiary">Workbook Chat</div>
            <h2 className="mt-2 text-lg font-medium">Ask CalcSense</h2>
            <div className="mt-2 text-sm text-text-secondary">Use workbook context to explain formulas, surface trends, suggest edits, and draft charts you can insert back into Excel.</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-border-subtle px-3 py-2 text-sm">Close</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(MODE_META) as Array<keyof typeof MODE_META>).map((mode) => {
            const meta = MODE_META[mode];
            const active = chatMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setChatMode(mode)}
                className={`rounded-full px-4 py-2 text-sm transition ${active ? meta.activeTone : "bg-bg-elevated text-text-secondary"}`}
              >
                <span className="mr-2">{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ContextChip tone="sheet" label={`Sheet ${sheet}`} />
          {selectedCell ? <ContextChip tone="cell" label={`Cell ${selectedCell}`} /> : null}
          {selectedTables.map((index) => (
            tables[index] ? (
              <ContextChip key={tables[index].range} tone="table" label={`Table ${tables[index].range}`} onRemove={() => setSelectedTables((current) => current.filter((item) => item !== index))} />
            ) : null
          ))}
        </div>
        {tables.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tables.slice(0, 6).map((table, index) => {
              const active = selectedTables.includes(index);
              return (
                <button key={table.range} onClick={() => setSelectedTables((current) => active ? current.filter((item) => item !== index) : [...current, index])} className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-accent bg-accent text-white shadow-sm" : "border-border-subtle bg-white text-text-secondary"}`}>
                  T{index + 1} {table.range}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => void handleWorkbookOverview()}
            disabled={streaming}
            className="rounded-full border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent transition hover:shadow-sm disabled:opacity-50"
          >
            Workbook overview
          </button>
          <button
            onClick={() => void handleWorkbookHealth()}
            disabled={streaming}
            className="rounded-full border border-blue/20 bg-blue/5 px-3 py-2 text-xs text-blue transition hover:shadow-sm disabled:opacity-50"
          >
            Health scan
          </button>
          <button
            onClick={() => void handleDriverRanking()}
            disabled={streaming}
            className="rounded-full border border-violet/20 bg-violet/5 px-3 py-2 text-xs text-violet transition hover:shadow-sm disabled:opacity-50"
          >
            Rank drivers
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-5">
        {error ? (
          <div className="rounded-2xl border border-rose/20 bg-rose-glow px-4 py-3 text-sm text-rose">
            {error}
          </div>
        ) : null}
        {!messages.length ? (
          <div className="rounded-3xl border border-border-subtle bg-bg-elevated p-5">
            <div className="text-sm text-text-secondary">
              I&apos;m looking at {selectedCell ? `cell ${selectedCell}` : `sheet ${sheet}`}. {tables.length ? `I can also use ${tables.length} detected table${tables.length > 1 ? "s" : ""} as context.` : "No tables are selected yet."}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void handleWorkbookOverview()} className="rounded-full border border-accent/20 bg-accent/5 px-3 py-2 text-sm text-accent transition hover:shadow-sm">
                What does this workbook do?
              </button>
              <button onClick={() => void handleWorkbookHealth()} className="rounded-full border border-blue/20 bg-blue/5 px-3 py-2 text-sm text-blue transition hover:shadow-sm">
                Run a health review
              </button>
              <button onClick={() => void handleDriverRanking()} className="rounded-full border border-violet/20 bg-violet/5 px-3 py-2 text-sm text-violet transition hover:shadow-sm">
                Rank the drivers
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {activePromptHints.map((hint) => (
                <button key={hint.text} onClick={() => void submit(hint.text)} className={`rounded-full border px-3 py-2 text-sm transition hover:shadow-sm ${KIND_META[hint.kind]}`}>
                  {hint.text}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {statusSteps.length ? (
          <div className="rounded-3xl border border-border-subtle bg-white p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Thinking trail</div>
            <div className="mt-3 space-y-2">
              {statusSteps.map((step) => {
                const active = activeStatus === step.text;
                const done = !active;
                return (
                  <div key={`${step.time}-${step.text}`} className={`flex items-center gap-3 text-sm ${active ? "text-accent" : "text-text-secondary"}`}>
                    <div className={`h-2.5 w-2.5 rounded-full ${active ? "animate-pulse-slow bg-accent" : done ? "bg-teal" : "bg-border-medium"}`} />
                    <div>{step.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {messages.map((message, index) => {
          const isAssistant = message.role === "assistant";
          const block = isAssistant ? parseMessageBlocks(message.text) : null;
          return (
            <div key={`${message.role}-${index}`} className={`rounded-3xl p-4 ${isAssistant ? "border border-border-subtle bg-white" : "ml-10 bg-accent text-white"}`}>
              <div className="text-xs uppercase tracking-[0.18em] opacity-70">{isAssistant ? "CalcSense" : "You"}</div>
              {block?.text ? (
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{renderMessageText(block.text, sheet)}</div>
              ) : !isAssistant ? (
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</div>
              ) : null}
              {block?.chart ? <div className="mt-4"><SimpleChart spec={block.chart} /></div> : null}
              {block?.edit?.edits?.length ? (
                <EditPreview
                  edits={block.edit.edits}
                  onApply={async () => {
                    try {
                      setError("");
                      await editCells(fileId, sheet, block.edit!.edits);
                      await onRefresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Applying edits failed.");
                    }
                  }}
                />
              ) : null}
            </div>
          );
        })}
        {parsed?.chart ? (
          <button
            className="rounded-2xl bg-violet px-4 py-2 text-sm text-white"
            onClick={async () => {
              try {
                setError("");
                await insertChart(fileId, sheet, parsed.chart!, selectedTables.length ? tables[selectedTables[0]]?.range : undefined);
                await onRefresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Chart insertion failed.");
              }
            }}
          >
            Insert into Excel
          </button>
        ) : null}
      </div>
      <div className="border-t border-border-subtle p-4">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about formulas, business drivers, charts, or workbook edits"
          className="h-28 w-full rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-text-tertiary">{streaming ? "Generating workbook-aware answer..." : "Workbook-aware responses only"}</div>
          <button onClick={() => void submit()} disabled={streaming} className="rounded-2xl bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
