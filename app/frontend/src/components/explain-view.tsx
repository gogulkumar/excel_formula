"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export function ExplainView({
  explanation,
  businessSummary,
  explaining,
  summarizing,
  onExplain,
  onBusinessSummary,
}: {
  explanation: string;
  businessSummary: string;
  explaining: boolean;
  summarizing: boolean;
  onExplain: () => void;
  onBusinessSummary: () => void;
}) {
  const [tab, setTab] = useState<"technical" | "business">("technical");
  return (
    <div className="rounded-3xl border border-border-subtle bg-white">
      <div className="flex gap-2 border-b border-border-subtle p-3">
        <button className={`rounded-full px-4 py-2 text-sm ${tab === "technical" ? "bg-accent text-white" : "bg-bg-elevated"}`} onClick={() => setTab("technical")}>Technical</button>
        <button className={`rounded-full px-4 py-2 text-sm ${tab === "business" ? "bg-accent text-white" : "bg-bg-elevated"}`} onClick={() => setTab("business")}>Business</button>
      </div>
      <div className="min-h-[360px] p-6">
        {tab === "technical" ? (
          explanation ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{explanation}</ReactMarkdown>
            </div>
          ) : (
            <button className="rounded-2xl bg-accent px-5 py-3 text-white" onClick={onExplain} disabled={explaining}>
              {explaining ? "Generating..." : "Technical Breakdown"}
            </button>
          )
        ) : businessSummary ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{businessSummary}</ReactMarkdown>
          </div>
        ) : (
          <button className="rounded-2xl bg-teal px-5 py-3 text-white" onClick={onBusinessSummary} disabled={summarizing}>
            {summarizing ? "Generating..." : "Business Summary"}
          </button>
        )}
      </div>
    </div>
  );
}
