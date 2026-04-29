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
      className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all hover:scale-110 hover:shadow-sm ${color ? "border-transparent hover:border-[#a19f9d]" : "border-[#e1dfdd] bg-white hover:bg-[#f3f2f1]"}`}
      style={color ? { backgroundColor: color } : {}}
      title={color || "Clear"}
    >
      {!color ? <div className="h-0.5 w-4 -rotate-45 bg-[#d13438]"></div> : null}
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
    <div className="flex flex-wrap items-center gap-4 border-b border-[#e1dfdd] bg-[#fbfaf7] px-6 py-3">
      {/* Font Styles */}
      <div className="flex items-center gap-1">
        <button
          disabled={disabled}
          onClick={() => setBold((v) => (v === true ? null : true))}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold transition-colors disabled:opacity-50 ${bold ? "bg-[#e1dfdd] text-black" : "text-[#605e5c] hover:bg-[#edebe9]"}`}
          title="Bold"
        >
          B
        </button>
        <button
          disabled={disabled}
          onClick={() => setItalic((v) => (v === true ? null : true))}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-sm italic transition-colors disabled:opacity-50 ${italic ? "bg-[#e1dfdd] text-black" : "text-[#605e5c] hover:bg-[#edebe9]"}`}
          title="Italic"
        >
          I
        </button>
        <button
          disabled={disabled}
          onClick={() => { setFill(""); setFontColor(""); setBold(null); setItalic(null); setNumberFormat(""); }}
          className="ml-1 flex h-8 px-3 items-center justify-center rounded-md text-xs font-medium text-[#605e5c] hover:bg-[#edebe9] transition-colors disabled:opacity-50"
          title="Clear Formatting"
        >
          Clear
        </button>
      </div>

      <div className="h-5 w-px bg-[#e1dfdd]"></div>

      {/* Fill Color */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a19f9d]">Fill</span>
        <div className="flex flex-wrap items-center gap-1">
          {FILL_COLORS.map((color) => <Swatch key={color || "clear-fill"} color={color} onClick={() => setFill(color)} />)}
        </div>
      </div>

      <div className="h-5 w-px bg-[#e1dfdd]"></div>

      {/* Font Color */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a19f9d]">Text</span>
        <div className="flex items-center gap-1">
          {FONT_COLORS.map((color) => <Swatch key={color || "clear-font"} color={color} onClick={() => setFontColor(color)} />)}
        </div>
      </div>

      <div className="h-5 w-px bg-[#e1dfdd]"></div>

      {/* Number Format */}
      <div className="flex items-center gap-3">
        <select
          disabled={disabled}
          value={numberFormat}
          onChange={(event) => setNumberFormat(event.target.value)}
          className="h-8 rounded-md border border-[#e1dfdd] bg-white px-3 text-xs text-[#323130] outline-none transition-shadow hover:border-[#c8c6c4] focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316]/30 disabled:opacity-50"
        >
          {NUMBER_FORMATS.map((item) => (
            <option key={item.label} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      <div className="ml-auto">
        <button
          disabled={disabled}
          onClick={() => void onApply({ fill, font_color: fontColor, bold, italic, number_format: numberFormat })}
          className="flex h-8 items-center rounded-md bg-accent px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-dim disabled:opacity-50"
        >
          Apply Format
        </button>
      </div>
    </div>
  );
}
