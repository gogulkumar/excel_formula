/**
 * Server-side Excel utilities using SheetJS (xlsx).
 * Replaces the Python/openpyxl backend logic entirely.
 */
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraceNode {
  cell: string;
  sheet: string;
  value: string;
  formula: string | null;
  deps: TraceNode[];
  ranges: { sheet: string; range: string; headers: string[] }[];
  external: boolean;
  truncated?: boolean;
  meta?: string;
}

export interface CellData {
  r: string;
  v: string;
  f: string | null;
  s?: { bg?: string; fg?: string; b?: number; i?: number; nf?: string } | null;
  m?: string;
}

export interface SheetData {
  headers: string[];
  rows: CellData[][];
}

export interface TableRegion {
  range: string;
  top_left: string;
  rows: number;
  cols: number;
  cells: number;
  formulas: number;
  numbers: number;
  texts: number;
  headers: string[];
  has_header: boolean;
  preview: string[][];
}

// ─── Column utilities ─────────────────────────────────────────────────────────

export function colToLetter(n: number): string {
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function letterToCol(letters: string): number {
  let col = 0;
  for (const ch of letters.toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
  return col;
}

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]{1,3})(\d{1,7})$/.exec(ref.replace(/\$/g, "").toUpperCase());
  if (!m) return null;
  return { col: letterToCol(m[1]), row: parseInt(m[2]) };
}

export function encodeRange(r1: number, c1: number, r2: number, c2: number): string {
  return `${colToLetter(c1)}${r1}:${colToLetter(c2)}${r2}`;
}

export function decodeRange(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const parts = range.split(":");
  if (parts.length !== 2) return null;
  const a = parseCellRef(parts[0]);
  const b = parseCellRef(parts[1]);
  if (!a || !b) return null;
  return { r1: a.row, c1: a.col, r2: b.row, c2: b.col };
}

function cellInRange(cell: string, range: string): boolean {
  const p = parseCellRef(cell);
  const r = decodeRange(range);
  if (!p || !r) return false;
  return p.col >= r.c1 && p.col <= r.c2 && p.row >= r.r1 && p.row <= r.r2;
}

// ─── Formula reference parser ─────────────────────────────────────────────────

// Match cross-sheet refs: 'Sheet Name'!A1:B2 or Sheet1!A1
const CROSS_SHEET_RE = /(?:'([^']+)'|([A-Za-z_][\w .-]*))\!(\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?)/g;
// Match same-sheet cell/range refs (not preceded by ! or letters)
const SAME_SHEET_RE = /(?<![!A-Za-z])(\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?)(?![A-Za-z])/g;

export function parseRefs(
  formula: string | null,
  defaultSheet: string,
): { cells: [string, string][]; ranges: [string, string][]; hasExternal: boolean } {
  if (!formula || !formula.startsWith("=")) return { cells: [], ranges: [], hasExternal: false };

  // Strip string literals so we don't extract refs from "A1" inside TEXT()
  const cleaned = formula.replace(/"[^"]*"/g, '""');
  const hasExternal = /\[[^\]]+\]/.test(cleaned);

  const cells: [string, string][] = [];
  const ranges: [string, string][] = [];
  const seen = new Set<string>();

  // Cross-sheet refs first
  CROSS_SHEET_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CROSS_SHEET_RE.exec(cleaned)) !== null) {
    const sheet = (match[1] ?? match[2]).trim();
    const ref = match[3].replace(/\$/g, "").toUpperCase();
    const key = `${sheet}!${ref}`;
    if (!seen.has(key)) {
      seen.add(key);
      if (ref.includes(":")) ranges.push([sheet, ref]);
      else cells.push([sheet, ref]);
    }
  }

  // Same-sheet refs (strip cross-sheet pattern first)
  const noXSheet = cleaned.replace(CROSS_SHEET_RE, " ");
  SAME_SHEET_RE.lastIndex = 0;
  while ((match = SAME_SHEET_RE.exec(noXSheet)) !== null) {
    const ref = match[1].replace(/\$/g, "").toUpperCase();
    // Skip obvious non-cell patterns (single letters used as functions, etc.)
    if (/^[A-Z]{1,3}$/.test(ref)) continue;
    const key = `${defaultSheet}!${ref}`;
    if (!seen.has(key)) {
      seen.add(key);
      if (ref.includes(":")) ranges.push([defaultSheet, ref]);
      else cells.push([defaultSheet, ref]);
    }
  }

  return { cells, ranges, hasExternal };
}

// ─── Workbook loading ─────────────────────────────────────────────────────────

export function loadWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, {
    type: "buffer",
    cellFormula: true,
    cellStyles: true,
    cellDates: true,
    dense: false,
  });
}

function getCellFormula(ws: XLSX.WorkSheet, ref: string): string | null {
  const cell = ws[ref] as XLSX.CellObject | undefined;
  if (!cell) return null;
  const f = cell.f;
  if (!f) return null;
  return f.startsWith("=") ? f : `=${f}`;
}

function getCellValue(ws: XLSX.WorkSheet, ref: string): string {
  const cell = ws[ref] as XLSX.CellObject | undefined;
  if (!cell) return "";
  if (cell.v === null || cell.v === undefined) return "";
  if (cell.t === "d" && cell.v instanceof Date) return cell.v.toISOString().split("T")[0];
  return String(cell.w ?? cell.v);
}

function argbToHex(argb: string | undefined): string | null {
  if (!argb) return null;
  const s = String(argb).toUpperCase();
  if (s.length === 8) {
    const alpha = s.slice(0, 2);
    if (alpha === "00") return null;
    return `#${s.slice(2)}`;
  }
  if (s.length === 6) return `#${s}`;
  return null;
}

function extractCellStyle(cell: XLSX.CellObject): CellData["s"] {
  const out: NonNullable<CellData["s"]> = {};
  // SheetJS stores styles in cell.s after reading with cellStyles:true
  const s = (cell as unknown as { s?: Record<string, unknown> }).s;
  if (!s) return null;

  const fill = s.fgColor as { rgb?: string } | undefined;
  const bg = argbToHex(fill?.rgb);
  if (bg && bg !== "#FFFFFF") out.bg = bg;

  const font = s.color as { rgb?: string } | undefined;
  const fg = argbToHex(font?.rgb);
  if (fg && fg !== "#000000") out.fg = fg;

  if (s.bold) out.b = 1;
  if (s.italic) out.i = 1;
  if (s.numFmt && s.numFmt !== "General" && s.numFmt !== "@") out.nf = String(s.numFmt);

  return Object.keys(out).length ? out : null;
}

// ─── Cell label (context) builder ─────────────────────────────────────────────

function isNumericish(v: unknown): boolean {
  if (typeof v === "number") return true;
  if (typeof v !== "string") return false;
  const t = v.replace(/[,%$\s]/g, "");
  return t.length > 0 && !isNaN(Number(t));
}

export function computeCellLabel(wb: XLSX.WorkBook, sheet: string, cellRef: string): string {
  const ws = wb.Sheets[sheet];
  if (!ws) return `${sheet}!${cellRef}`;
  const parsed = parseCellRef(cellRef);
  if (!parsed) return `${sheet}!${cellRef}`;
  const { col, row } = parsed;

  const labels: string[] = [];

  // Scan left for text label
  for (let c = col - 1; c >= 1; c--) {
    const ref = `${colToLetter(c)}${row}`;
    const cell = ws[ref] as XLSX.CellObject | undefined;
    const raw = cell?.v;
    if (typeof raw === "string" && raw.trim() && !raw.startsWith("=") && !isNumericish(raw)) {
      labels.push(raw.trim());
      break;
    }
    if (raw !== undefined && raw !== null && raw !== "") break;
  }

  // Scan up for text label
  for (let r = row - 1; r >= 1; r--) {
    const ref = `${colToLetter(col)}${r}`;
    const cell = ws[ref] as XLSX.CellObject | undefined;
    const raw = cell?.v;
    if (typeof raw === "string" && raw.trim() && !raw.startsWith("=") && !isNumericish(raw)) {
      labels.push(raw.trim());
      break;
    }
    if (raw !== undefined && raw !== null && raw !== "") break;
  }

  return labels.length ? labels.join(" · ") : `${sheet}!${cellRef}`;
}

// ─── Sheet extent ─────────────────────────────────────────────────────────────

function getSheetExtent(ws: XLSX.WorkSheet): { maxRow: number; maxCol: number } {
  const ref = ws["!ref"];
  if (!ref) return { maxRow: 1, maxCol: 1 };
  const r = decodeRange(ref);
  if (!r) return { maxRow: 1, maxCol: 1 };
  return {
    maxRow: Math.min(r.r2, 5000),
    maxCol: Math.min(r.c2, 500),
  };
}

// ─── Sheet data ───────────────────────────────────────────────────────────────

export function getSheetData(wb: XLSX.WorkBook, sheet: string): SheetData {
  const ws = wb.Sheets[sheet];
  if (!ws) return { headers: [], rows: [] };

  const { maxRow, maxCol } = getSheetExtent(ws);
  const headers = Array.from({ length: maxCol }, (_, i) => colToLetter(i + 1));
  const rows: CellData[][] = [];

  for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
    const rowData: CellData[] = [];
    for (let colNum = 1; colNum <= maxCol; colNum++) {
      const ref = `${colToLetter(colNum)}${rowNum}`;
      const cell = ws[ref] as XLSX.CellObject | undefined;
      if (!cell && !ws[ref]) continue;
      const formula = getCellFormula(ws, ref);
      const value = getCellValue(ws, ref);
      if (!formula && value === "") continue;

      const entry: CellData = { r: ref, v: value, f: formula };
      if (cell) {
        const style = extractCellStyle(cell);
        if (style) entry.s = style;
      }
      if (formula) {
        const meta = computeCellLabel(wb, sheet, ref);
        if (meta && meta !== `${sheet}!${ref}`) entry.m = meta;
      }
      rowData.push(entry);
    }
    rows.push(rowData);
  }

  return { headers, rows };
}

// ─── Formula tracing ──────────────────────────────────────────────────────────

function expandRangeFormulaCells(ws: XLSX.WorkSheet, rangeRef: string): string[] {
  const r = decodeRange(rangeRef);
  if (!r) return [];
  const out: string[] = [];
  let scanned = 0;
  for (let row = r.r1; row <= r.r2; row++) {
    for (let col = r.c1; col <= r.c2; col++) {
      const ref = `${colToLetter(col)}${row}`;
      const cell = ws[ref] as XLSX.CellObject | undefined;
      if (cell?.f) out.push(ref);
      if (++scanned >= 10_000) return out;
    }
  }
  return out;
}

function getRangeHeaders(wb: XLSX.WorkBook, sheet: string, rangeRef: string): string[] {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  const r = decodeRange(rangeRef);
  if (!r) return [];
  const headers: string[] = [];
  for (let col = r.c1; col <= r.c2; col++) {
    let found: string | null = null;
    for (let row = Math.max(r.r1 - 1, 1); row >= 1; row--) {
      const ref = `${colToLetter(col)}${row}`;
      const cell = ws[ref] as XLSX.CellObject | undefined;
      const raw = cell?.v;
      if (typeof raw === "string" && raw.trim() && !isNumericish(raw) && !raw.startsWith("=")) {
        found = raw.trim();
        break;
      }
    }
    headers.push(found ?? colToLetter(col));
  }
  return headers;
}

export function traceNode(
  wb: XLSX.WorkBook,
  sheet: string,
  cell: string,
  visited: Set<string>,
  depth: number,
  maxDepth: number,
): TraceNode {
  const key = `${sheet}!${cell}`;
  if (visited.has(key)) {
    return { cell, sheet, value: "[circular]", formula: null, deps: [], ranges: [], external: false };
  }
  if (!wb.Sheets[sheet]) {
    return { cell, sheet, value: `[sheet '${sheet}' not found]`, formula: null, deps: [], ranges: [], external: false };
  }

  const ws = wb.Sheets[sheet];
  const formula = getCellFormula(ws, cell);
  const value = getCellValue(ws, cell);
  const node: TraceNode = { cell, sheet, value, formula, deps: [], ranges: [], external: false };

  if (depth >= maxDepth) {
    node.truncated = true;
    return node;
  }

  const { cells, ranges, hasExternal } = parseRefs(formula, sheet);
  node.external = hasExternal;

  const nextVisited = new Set(visited);
  nextVisited.add(key);
  const seen = new Set<string>();

  for (const [refSheet, refCell] of cells) {
    const depKey = `${refSheet}!${refCell}`;
    if (seen.has(depKey)) continue;
    seen.add(depKey);
    node.deps.push(traceNode(wb, refSheet, refCell, nextVisited, depth + 1, maxDepth));
  }

  for (const [rangeSheet, rangeRef] of ranges) {
    const headers = getRangeHeaders(wb, rangeSheet, rangeRef);
    node.ranges.push({ sheet: rangeSheet, range: rangeRef, headers });
    const rangeWs = wb.Sheets[rangeSheet];
    if (rangeWs) {
      for (const coord of expandRangeFormulaCells(rangeWs, rangeRef)) {
        const depKey = `${rangeSheet}!${coord}`;
        if (seen.has(depKey)) continue;
        seen.add(depKey);
        node.deps.push(traceNode(wb, rangeSheet, coord, nextVisited, depth + 1, maxDepth));
      }
    }
  }

  return node;
}

export function addMetaToTrace(wb: XLSX.WorkBook, node: TraceNode): TraceNode {
  node.meta = computeCellLabel(wb, node.sheet, node.cell);
  node.deps = node.deps.map((d) => addMetaToTrace(wb, d));
  return node;
}

// ─── Ref index (who references what) ─────────────────────────────────────────

export type RefIndex = Record<string, Array<[string, string]>>;

export function buildRefIndex(wb: XLSX.WorkBook): RefIndex {
  const index: RefIndex = {};
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const { maxRow, maxCol } = getSheetExtent(ws);
    for (let row = 1; row <= maxRow; row++) {
      for (let col = 1; col <= maxCol; col++) {
        const ref = `${colToLetter(col)}${row}`;
        const cell = ws[ref] as XLSX.CellObject | undefined;
        if (!cell?.f) continue;
        const formula = `=${cell.f}`;
        const { cells, ranges } = parseRefs(formula, sheetName);
        for (const [refSheet, refCell] of cells) {
          const key = `${refSheet}!${refCell}`;
          (index[key] ??= []).push([sheetName, ref]);
        }
        for (const [refSheet, rangeRef] of ranges) {
          const key = `RANGE:${refSheet}!${rangeRef}`;
          (index[key] ??= []).push([sheetName, ref]);
        }
      }
    }
  }
  return index;
}

export function traceUp(
  wb: XLSX.WorkBook,
  fid: string,
  sheet: string,
  cell: string,
  index: RefIndex,
  visited: Set<string>,
): TraceNode {
  const key = `${sheet}!${cell}`;
  if (visited.has(key)) {
    return { cell, sheet, value: "[circular]", formula: null, deps: [], ranges: [], external: false };
  }

  const parents: Array<[string, string]> = [...(index[key] ?? [])];
  // Also check if cell falls inside any range refs
  for (const [idxKey, refs] of Object.entries(index)) {
    if (!idxKey.startsWith("RANGE:")) continue;
    const target = idxKey.slice("RANGE:".length);
    const bangIdx = target.indexOf("!");
    if (bangIdx < 0) continue;
    const rangeSheet = target.slice(0, bangIdx);
    const rangeRef = target.slice(bangIdx + 1);
    if (rangeSheet === sheet && cellInRange(cell, rangeRef)) {
      parents.push(...refs);
    }
  }

  const ws = wb.Sheets[sheet];
  const formula = ws ? getCellFormula(ws, cell) : null;
  const value = ws ? getCellValue(ws, cell) : "";
  const node: TraceNode = { cell, sheet, value, formula, deps: [], ranges: [], external: false };

  const nextVisited = new Set(visited);
  nextVisited.add(key);
  const seen = new Set<string>();

  for (const [parentSheet, parentCell] of parents) {
    const pKey = `${parentSheet}!${parentCell}`;
    if (seen.has(pKey)) continue;
    seen.add(pKey);
    node.deps.push(traceUp(wb, fid, parentSheet, parentCell, index, nextVisited));
  }

  return node;
}

// ─── Top-level metrics ────────────────────────────────────────────────────────

export function getTopMetrics(
  wb: XLSX.WorkBook,
  sheets: string[],
  minRefs: number,
): Array<{ cell: string; sheet: string; formula: string; value: string; label: string; ref_count: number }> {
  const index = buildRefIndex(wb);
  const referenced = new Set<string>(
    Object.keys(index).filter((k) => !k.startsWith("RANGE:")),
  );
  // Also mark range-covered cells as referenced
  for (const [key] of Object.entries(index)) {
    if (!key.startsWith("RANGE:")) continue;
    const target = key.slice("RANGE:".length);
    const bangIdx = target.indexOf("!");
    if (bangIdx < 0) continue;
    const rangeSheet = target.slice(0, bangIdx);
    const rangeRef = target.slice(bangIdx + 1);
    const r = decodeRange(rangeRef);
    if (!r) continue;
    let scanned = 0;
    for (let row = r.r1; row <= r.r2; row++) {
      for (let col = r.c1; col <= r.c2; col++) {
        referenced.add(`${rangeSheet}!${colToLetter(col)}${row}`);
        if (++scanned >= 10_000) break;
      }
      if (scanned >= 10_000) break;
    }
  }

  const results: ReturnType<typeof getTopMetrics> = [];

  for (const sheet of sheets) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const { maxRow, maxCol } = getSheetExtent(ws);
    for (let row = 1; row <= maxRow; row++) {
      for (let col = 1; col <= maxCol; col++) {
        const ref = `${colToLetter(col)}${row}`;
        const key = `${sheet}!${ref}`;
        if (referenced.has(key)) continue;
        const cell = ws[ref] as XLSX.CellObject | undefined;
        if (!cell?.f) continue;
        const formula = `=${cell.f}`;
        const { cells, ranges } = parseRefs(formula, sheet);
        const refCount = cells.length + ranges.length;
        if (refCount < minRefs) continue;
        results.push({
          cell: ref,
          sheet,
          formula,
          value: getCellValue(ws, ref),
          label: computeCellLabel(wb, sheet, ref),
          ref_count: refCount,
        });
      }
    }
  }

  results.sort((a, b) => b.ref_count - a.ref_count);
  return results.slice(0, 60);
}

// ─── Table detection ──────────────────────────────────────────────────────────

export function detectTables(wb: XLSX.WorkBook, sheet: string): TableRegion[] {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  const { maxRow, maxCol } = getSheetExtent(ws);

  // Build occupied set
  const occupied = new Set<string>();
  for (let row = 1; row <= maxRow; row++) {
    for (let col = 1; col <= maxCol; col++) {
      const ref = `${colToLetter(col)}${row}`;
      const cell = ws[ref] as XLSX.CellObject | undefined;
      if (cell && (cell.v !== null && cell.v !== undefined && cell.v !== "")) {
        occupied.add(`${row},${col}`);
      }
    }
  }

  const seen = new Set<string>();
  const tables: TableRegion[] = [];

  for (const pos of occupied) {
    if (seen.has(pos)) continue;
    const [startRow, startCol] = pos.split(",").map(Number);
    // BFS flood fill
    const queue: [number, number][] = [[startRow, startCol]];
    const component: [number, number][] = [];
    seen.add(pos);
    while (queue.length) {
      const [r, c] = queue.shift()!;
      component.push([r, c]);
      for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][]) {
        const nk = `${nr},${nc}`;
        if (!seen.has(nk) && occupied.has(nk)) {
          seen.add(nk);
          queue.push([nr, nc]);
        }
      }
    }

    const rows = component.map(([r]) => r);
    const cols = component.map(([, c]) => c);
    const minRow = Math.min(...rows), maxRow2 = Math.max(...rows);
    const minCol = Math.min(...cols), maxCol2 = Math.max(...cols);
    const rowCount = maxRow2 - minRow + 1;
    const colCount = maxCol2 - minCol + 1;
    if (component.length < 8 || rowCount < 3 || colCount < 2) continue;

    let formulas = 0, numbers = 0, texts = 0;
    const preview: string[][] = [];
    const headers: string[] = [];

    for (let col = minCol; col <= maxCol2; col++) {
      const ref = `${colToLetter(col)}${minRow}`;
      const cell = ws[ref] as XLSX.CellObject | undefined;
      const v = cell?.v;
      if (typeof v === "string" && v.trim() && !isNumericish(v)) headers.push(v.trim());
    }

    for (let row = minRow; row <= maxRow2; row++) {
      const previewRow: string[] = [];
      for (let col = minCol; col <= maxCol2; col++) {
        const ref = `${colToLetter(col)}${row}`;
        const cell = ws[ref] as XLSX.CellObject | undefined;
        const v = cell?.v;
        if (cell?.f) formulas++;
        else if (typeof v === "number") numbers++;
        else if (v !== null && v !== undefined && v !== "") texts++;
        if (row <= minRow + 3) previewRow.push(v === null || v === undefined ? "" : String(v));
      }
      if (previewRow.length) preview.push(previewRow);
    }

    tables.push({
      range: encodeRange(minRow, minCol, maxRow2, maxCol2),
      top_left: `${colToLetter(minCol)}${minRow}`,
      rows: rowCount,
      cols: colCount,
      cells: component.length,
      formulas,
      numbers,
      texts,
      headers,
      has_header: headers.length > 0,
      preview: preview.slice(0, 4),
    });
  }

  tables.sort((a, b) => {
    const [aCol, aRow] = [letterToCol(a.top_left.replace(/\d+/g, "")), parseInt(a.top_left.replace(/\D/g, ""))];
    const [bCol, bRow] = [letterToCol(b.top_left.replace(/\d+/g, "")), parseInt(b.top_left.replace(/\D/g, ""))];
    return aRow !== bRow ? aRow - bRow : aCol - bCol;
  });
  return tables.slice(0, 50);
}

// ─── Trace to text (for LLM prompts) ─────────────────────────────────────────

export function traceToText(node: TraceNode, depth = 0): string {
  const indent = "    ".repeat(depth);
  const meta = node.meta ? ` | Context: ${node.meta}` : "";
  const line = `${indent}- ${node.sheet}!${node.cell} | Formula: ${node.formula ?? "none"} | Value: ${node.value}${meta}`;
  const rangeLines = node.ranges.map((rng) => {
    const headers = rng.headers.length ? ` | Headers: ${rng.headers.join(", ")}` : "";
    return `${indent}    Range: ${rng.sheet}!${rng.range}${headers}`;
  });
  const childLines = node.deps.map((dep) => traceToText(dep, depth + 1));
  return [line, ...rangeLines, ...childLines].join("\n");
}

// ─── Table metrics (for table analysis panel) ─────────────────────────────────

export interface TableMetric {
  label: string;
  cells: TraceNode[];
}

export function extractTableMetrics(
  wb: XLSX.WorkBook,
  sheet: string,
  tableRange: string,
  maxDepth = 5,
): TableMetric[] {
  const r = decodeRange(tableRange);
  if (!r) return [];
  const ws = wb.Sheets[sheet];
  if (!ws) return [];

  // Find formula cells in the table's last column (output column pattern)
  const metrics: TableMetric[] = [];
  const seen = new Set<string>();

  for (let row = r.r1; row <= r.r2; row++) {
    for (let col = r.c2; col >= r.c1; col--) {
      const ref = `${colToLetter(col)}${row}`;
      const cell = ws[ref] as XLSX.CellObject | undefined;
      if (!cell?.f) continue;
      const label = computeCellLabel(wb, sheet, ref);
      if (seen.has(label)) continue;
      seen.add(label);
      const trace = addMetaToTrace(wb, traceNode(wb, sheet, ref, new Set(), 0, maxDepth));
      metrics.push({ label, cells: [trace] });
    }
  }

  return metrics.slice(0, 20);
}

// ─── Cell edit / format ───────────────────────────────────────────────────────

export function applyCellEdits(
  wb: XLSX.WorkBook,
  sheet: string,
  edits: Array<{ cell: string; value?: unknown; formula?: string | null }>,
): void {
  const ws = wb.Sheets[sheet];
  if (!ws) return;
  for (const edit of edits) {
    if (edit.formula) {
      ws[edit.cell] = { t: "n", v: 0, f: edit.formula.replace(/^=/, "") };
    } else if (edit.value === null || edit.value === undefined) {
      delete ws[edit.cell];
    } else if (typeof edit.value === "number") {
      ws[edit.cell] = { t: "n", v: edit.value };
    } else {
      ws[edit.cell] = { t: "s", v: String(edit.value) };
    }
  }
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
