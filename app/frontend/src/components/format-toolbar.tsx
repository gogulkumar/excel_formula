"use client";

import { useState } from "react";

const FILL_COLORS = ["", "#FFE066", "#FECACA", "#DCFCE7", "#DBEAFE", "#E9D5FF", "#FCE7F3", "#FEF3C7", "#E5E7EB"];
const FONT_COLORS = ["", "#1F2937", "#B91C1C", "#0F766E", "#2563EB", "#7C3AED", "#C2410C", "#047857"];
const NUMBER_FORMATS = [
  { label: "Auto", value: "" },
  { label: "1,234", value: "#,##0" },
  { label: "1,234.00", value: "#,##0.00" },
  { label: "$1,234", value: "$#,##0" },
  { label: "12.3%", value: "0.0%" },
  { label: "1.2K", value: "0.0,\"K\"" },
];

function Swatch({
  color,
  onClick,
}: {
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle transition hover:scale-110"
      style={{ backgroundColor: color || "#fff" }}
      title={color || "Clear"}
    >
      {!color ? <span className="text-xs text-rose">/</span> : null}
    </button>
  );
}

export function FormatToolbar({
  disabled,
  onApply,
}: {
  disabled?: boolean;
  onApply: (format: Record<string, unknown>) => Promise<void> | void;
}) {
  const [fill, setFill] = useState<string | null>(null);
  const [fontColor, setFontColor] = useState<string | null>(null);
  const [bold, setBold] = useState<boolean | null>(null);
  const [italic, setItalic] = useState<boolean | null>(null);
  const [numberFormat, setNumberFormat] = useState<string>("");

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle bg-white px-5 py-3">
      <div className="flex items-center gap-2">
        <button disabled={disabled} onClick={() => setBold((v) => (v === true ? null : true))} className={`rounded-xl border px-3 py-2 text-sm ${bold ? "border-accent bg-accent text-white" : "border-border-subtle bg-bg-elevated"}`}>B</button>
        <button disabled={disabled} onClick={() => setItalic((v) => (v === true ? null : true))} className={`rounded-xl border px-3 py-2 text-sm italic ${italic ? "border-accent bg-accent text-white" : "border-border-subtle bg-bg-elevated"}`}>I</button>
        <button disabled={disabled} onClick={() => { setFill(""); setFontColor(""); setBold(null); setItalic(null); setNumberFormat(""); }} className="rounded-xl border border-border-subtle px-3 py-2 text-sm text-text-secondary">Clear</button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Fill</span>
        <div className="grid grid-cols-3 gap-1 md:grid-cols-5">
          {FILL_COLORS.map((color) => <Swatch key={color || "clear-fill"} color={color} onClick={() => setFill(color)} />)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Font</span>
        <div className="grid grid-cols-4 gap-1">
          {FONT_COLORS.map((color) => <Swatch key={color || "clear-font"} color={color} onClick={() => setFontColor(color)} />)}
        </div>
      </div>
      <select
        disabled={disabled}
        value={numberFormat}
        onChange={(event) => setNumberFormat(event.target.value)}
        className="rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm"
      >
        {NUMBER_FORMATS.map((item) => (
          <option key={item.label} value={item.value}>{item.label}</option>
        ))}
      </select>
      <button
        disabled={disabled}
        onClick={() => void onApply({ fill, font_color: fontColor, bold, italic, number_format: numberFormat })}
        className="rounded-2xl bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Apply format
      </button>
    </div>
  );
}
