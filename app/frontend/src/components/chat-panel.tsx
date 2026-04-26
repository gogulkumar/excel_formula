"use client";

import { useMemo, useState } from "react";

import { editCells, insertChart, streamChat } from "@/lib/api";
import type { TableRegion } from "@/lib/types";

type Message = {
  role: "user" | "assistant";
  text: string;
};

function parseBlocks(text: string) {
  const chartMatch = text.match(/```chart\s*([\s\S]*?)```/i);
  const editMatch = text.match(/```edit\s*([\s\S]*?)```/i);
  let chart: Record<string, unknown> | null = null;
  let edit: { edits: Array<{ cell: string; value?: unknown; formula?: string | null }> } | null = null;
  try {
    if (chartMatch) chart = JSON.parse(chartMatch[1]);
  } catch {}
  try {
    if (editMatch) edit = JSON.parse(editMatch[1]);
  } catch {}
  const cleaned = text
    .replace(/```chart[\s\S]*?```/gi, "")
    .replace(/```edit[\s\S]*?```/gi, "")
    .trim();
  return { chart, edit, text: cleaned };
}

function SimpleChart({ spec }: { spec: Record<string, unknown> }) {
  const series = Array.isArray(spec.series) ? spec.series : [];
  const first = series[0] as { data?: Array<{ label: string; value: number }> } | undefined;
  const points = first?.data || [];
  const max = Math.max(1, ...points.map((point) => Math.abs(Number(point.value) || 0)));
  return (
    <div className="rounded-2xl border border-border-subtle bg-white p-4">
      <div className="text-sm font-medium">{String(spec.title || "Chart preview")}</div>
      <div className="mt-4 space-y-2">
        {points.map((point) => {
          const value = Number(point.value) || 0;
          const width = `${Math.max(6, Math.round((Math.abs(value) / max) * 100))}%`;
          return (
            <div key={point.label} className="grid grid-cols-[90px_1fr_50px] items-center gap-3 text-xs">
              <div className="truncate text-text-secondary">{point.label}</div>
              <div className="h-3 rounded-full bg-bg-elevated">
                <div className={`h-3 rounded-full ${value < 0 ? "bg-rose" : "bg-accent"}`} style={{ width }} />
              </div>
              <div className="text-right font-mono-ui">{value}</div>
            </div>
          );
        })}
      </div>
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

  const activePromptHints = useMemo(() => {
    if (selectedCell) return [`Explain ${selectedCell}`, `Rewrite ${selectedCell}`, `What drives ${selectedCell}?`, `Create a chart for this metric`];
    if (tables.length) return ["Summarize this workbook", "Find the key metrics", "Create a revenue chart", "Suggest optimizations"];
    return ["Explain the current sheet", "Find anomalies", "Summarize the model", "Suggest edits"];
  }, [selectedCell, tables.length]);

  async function submit(prompt = input) {
    const message = prompt.trim();
    if (!message || streaming) return;
    const history = [...messages, { role: "user" as const, text: message }];
    setMessages(history);
    setInput("");
    setStreaming(true);
    let assistantText = "";
    setMessages((current) => [...current, { role: "assistant", text: "" }]);
    try {
      await streamChat(
        fileId,
        message,
        async (event) => {
          if (typeof event.text === "string") {
            assistantText += event.text;
            setMessages((current) => {
              const next = [...current];
              next[next.length - 1] = { role: "assistant", text: assistantText };
              return next;
            });
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
    } finally {
      setStreaming(false);
    }
  }

  const lastAssistant = messages.filter((item) => item.role === "assistant").at(-1);
  const parsed = lastAssistant ? parseBlocks(lastAssistant.text) : null;

  return (
    <aside className="animate-slide-in-right flex h-full flex-col rounded-[32px] border border-border-subtle bg-white">
      <div className="border-b border-border-subtle p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-text-tertiary">Workbook Chat</div>
            <h2 className="mt-2 text-lg font-medium">Ask CalcSense</h2>
            <div className="mt-2 text-sm text-text-secondary">Use the workbook context to explain formulas, suggest edits, or propose charts.</div>
          </div>
          <button onClick={onClose} className="rounded-full border border-border-subtle px-3 py-2 text-sm">Close</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["auto", "excel", "data", "business"] as const).map((mode) => (
            <button key={mode} onClick={() => setChatMode(mode)} className={`rounded-full px-4 py-2 text-sm ${chatMode === mode ? "bg-accent text-white" : "bg-bg-elevated"}`}>{mode}</button>
          ))}
        </div>
        {tables.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tables.slice(0, 6).map((table, index) => {
              const active = selectedTables.includes(index);
              return (
                <button key={table.range} onClick={() => setSelectedTables((current) => active ? current.filter((item) => item !== index) : [...current, index])} className={`rounded-full border px-3 py-1.5 text-xs ${active ? "border-accent bg-accent text-white" : "border-border-subtle bg-white text-text-secondary"}`}>
                  T{index + 1} {table.range}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-5">
        {!messages.length ? (
          <div className="rounded-3xl border border-border-subtle bg-bg-elevated p-5">
            <div className="text-sm text-text-secondary">I&apos;m looking at {selectedCell ? `cell ${selectedCell}` : `sheet ${sheet}`}. Try one of these prompts:</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {activePromptHints.map((hint) => (
                <button key={hint} onClick={() => void submit(hint)} className="rounded-full border border-border-subtle bg-white px-3 py-2 text-sm text-text-secondary transition hover:border-accent hover:text-accent">
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((message, index) => {
          const isAssistant = message.role === "assistant";
          const block = isAssistant ? parseBlocks(message.text) : null;
          return (
            <div key={`${message.role}-${index}`} className={`rounded-3xl p-4 ${isAssistant ? "border border-border-subtle bg-white" : "ml-10 bg-accent text-white"}`}>
              <div className="text-xs uppercase tracking-[0.18em] opacity-70">{isAssistant ? "CalcSense" : "You"}</div>
              {block?.text ? <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{block.text}</div> : !isAssistant ? <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.text}</div> : null}
              {block?.chart ? <div className="mt-4"><SimpleChart spec={block.chart} /></div> : null}
              {block?.edit?.edits?.length ? (
                <div className="mt-4 rounded-2xl border border-border-subtle bg-bg-elevated p-4">
                  <div className="text-sm font-medium">Suggested edits</div>
                  <div className="mt-3 space-y-2 text-sm text-text-secondary">
                    {block.edit.edits.map((edit) => (
                      <div key={edit.cell} className="font-mono-ui">{edit.cell}: {edit.formula ?? JSON.stringify(edit.value)}</div>
                    ))}
                  </div>
                  <button
                    className="mt-4 rounded-2xl bg-accent px-4 py-2 text-sm text-white"
                    onClick={async () => {
                      await editCells(fileId, sheet, block.edit!.edits);
                      await onRefresh();
                    }}
                  >
                    Apply edits
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        {parsed?.chart ? (
          <button
            className="rounded-2xl bg-violet px-4 py-2 text-sm text-white"
            onClick={async () => {
              await insertChart(fileId, sheet, parsed.chart!, selectedTables.length ? tables[selectedTables[0]]?.range : undefined);
              await onRefresh();
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
          <div className="text-xs text-text-tertiary">{streaming ? "Generating..." : "Workbook-aware responses only"}</div>
          <button onClick={() => void submit()} disabled={streaming} className="rounded-2xl bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
