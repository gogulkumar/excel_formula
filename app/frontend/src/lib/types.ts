export interface CellStyle {
  bg?: string;
  fg?: string;
  b?: 1;
  i?: 1;
  nf?: string;
}

export interface Cell {
  r: string;
  v: string;
  f: string | null;
  s?: CellStyle;
  m?: string;
}

export interface RangeRef {
  sheet: string;
  range: string;
  headers?: string[];
}

export interface TraceNode {
  cell: string;
  sheet: string;
  value: string;
  formula: string | null;
  deps: TraceNode[];
  ranges: RangeRef[];
  external?: boolean;
  meta?: string;
  truncated?: boolean;
}

export interface FileEntry {
  file_id: string;
  filename: string;
  sheets: string[];
}

export interface LocalFileEntry {
  path: string;
  filename: string;
  directory: string;
  size_bytes: number;
  modified_at: number;
}

export interface SheetData {
  headers: string[];
  rows: Cell[][];
}

export interface BackendStatus {
  stage: string;
  detail: string;
  files_total: number;
  files_loaded: number;
  ready: boolean;
}

export interface IndexingProgress {
  current: number;
  total: number;
  sheet: string;
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
  user_modified?: boolean;
  preferences?: {
    metric_axis?: "row" | "column";
    selected_metric_label?: string;
    overrides?: Array<{
      scope: "row" | "column";
      target: string;
      kind: "metric" | "numeric";
    }>;
  };
}

export interface TableMetric {
  label: string;
  cells: TraceNode[];
}

export interface TableTraceResult {
  metrics: TableMetric[];
  total_formulas: number;
  total_deps: number;
}

export interface OptimizeResult {
  verdict: "keep" | "optimize";
  reason?: string;
  summary?: string;
  removed?: string[];
  optimized_tree?: TraceNode;
}

export interface TopMetric {
  sheet: string;
  cell: string;
  label: string;
  formula: string;
  value: string;
}

export interface TopMetricDetail {
  trace: TraceNode;
  sheets_involved: string[];
  formula_text: string;
}

export interface TaskStartResponse {
  task_id?: string;
  cached?: boolean;
  text?: string;
}
