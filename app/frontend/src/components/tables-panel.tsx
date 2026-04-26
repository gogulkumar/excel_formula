"use client";

import type { TableRegion } from "@/lib/types";

export function TablesPanel({ tables }: { tables: TableRegion[] }) {
  return (
    <div className="rounded-3xl border border-border-subtle bg-white p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Tables</div>
      <div className="mt-4 space-y-3">
        {tables.map((table, index) => (
          <div key={table.range} className="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm">
            <div className="font-medium">T{index + 1} · {table.range}</div>
            <div className="mt-1 text-text-secondary">{table.rows} rows · {table.cols} cols · {table.formulas} formulas</div>
          </div>
        ))}
      </div>
    </div>
  );
}
