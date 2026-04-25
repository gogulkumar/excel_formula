import type { TraceNode } from "@/lib/types";

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return null;
  const [, letters, row] = match;
  let col = 0;
  for (const ch of letters) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { col, row: Number(row) };
}

export function colToLetter(n: number): string {
  let num = n;
  let out = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

export function parseRange(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const parts = range.split(":");
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return null;
  return { r1: start.row, c1: start.col, r2: end.row, c2: end.col };
}

export function describe(node: TraceNode): string {
  if (!node.formula && !node.value) return "Empty cell";
  if (!node.formula && !Number.isNaN(Number(node.value))) return `Fixed number: ${node.value}`;
  if (!node.formula) return `Text value: "${node.value}"`;
  const formula = node.formula.toUpperCase();
  const fnMatch = /^=([A-Z]+)\(/.exec(formula);
  const descriptions: Record<string, string> = {
    SUM: "Adds up a range of values",
    SUMIF: "Adds values that match a condition",
    SUMIFS: "Adds values that match multiple conditions",
    SUMPRODUCT: "Multiplies arrays then sums results",
    AVERAGE: "Calculates an average",
    COUNT: "Counts populated numeric entries",
    IF: "Returns one of two values based on a test",
    VLOOKUP: "Looks up a value in a table column",
    XLOOKUP: "Looks up a value in a range",
    INDEX: "Returns a value from a position in a range",
    MATCH: "Finds a position in a range",
    FILTER: "Filters a range based on a condition",
  };
  if (fnMatch) return descriptions[fnMatch[1]] || `Uses the ${fnMatch[1]}() function`;
  if (formula.includes("&")) return "Joins text pieces together";
  if (formula.includes("*")) return "Multiplies values";
  if (formula.includes("/")) return "Divides values";
  if (formula.includes("+") && formula.includes("-")) return "Does arithmetic (add/subtract)";
  if (formula.includes("+")) return "Adds values together";
  if (formula.includes("-")) return "Subtracts values";
  if (/^=('[^']+'|[A-Z0-9_ ]+)!?[A-Z]+\d+$/.test(formula)) return "Pulls value from another cell";
  return "Computes a value";
}

export function buildExpandedFormula(node: TraceNode): string {
  if (!node.formula) return node.value || "0";
  const depMap = new Map(node.deps.map((dep) => [`${dep.sheet}!${dep.cell}`, dep]));
  const regex = /(?:('([^']+)'|[A-Za-z_]\w*)!)?([A-Z]{1,3}\d{1,7})/g;
  const matches = [...node.formula.matchAll(regex)];
  let formula = node.formula;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    const sheet = match[2] || match[1]?.replace("!", "") || node.sheet;
    const ref = match[3];
    const dep = depMap.get(`${sheet}!${ref}`);
    if (!dep || match.index === undefined) continue;
    let replacement = buildExpandedFormula(dep);
    if (dep.formula && /[+-]/.test(dep.formula)) replacement = `(${replacement})`;
    formula = `${formula.slice(0, match.index)}${replacement}${formula.slice(match.index + match[0].length)}`;
  }
  return formula;
}

