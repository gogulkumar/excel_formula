from __future__ import annotations

import csv
import json
import os
import re
import shutil
import sys
import threading
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any, Generator
from urllib.parse import unquote

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from openpyxl import Workbook, load_workbook
from openpyxl.formula.tokenizer import Tokenizer
from openpyxl.utils import get_column_letter, range_boundaries

APP_ROOT = Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.append(str(APP_ROOT))

from config_loader import get_config_value
from llm_client import LLMClient


app = FastAPI(title="Excel Formula Tracer")
_cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:8080",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
REGISTRY_PATH = UPLOADS_DIR / "registry.json"
PROMPTS_DIR = APP_ROOT / "prompts"
MAX_DEPTH = 5

store: dict[str, dict[str, Any]] = {}
ref_index_cache: dict[str, dict[str, list[tuple[str, str]]]] = {}
sheet_cache: dict[str, dict[str, Any]] = {}
tables_cache: dict[str, list[dict[str, Any]]] = {}
LOCAL_FILE_LIMIT = 200


def _load_csv_workbook(raw: bytes):
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    text = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("Could not decode CSV file with utf-8, cp1252, or latin-1")
    reader = csv.reader(text.splitlines())
    for row_idx, row in enumerate(reader, start=1):
        for col_idx, value in enumerate(row, start=1):
            if isinstance(value, str) and value.startswith("="):
                ws.cell(row=row_idx, column=col_idx, value=value)
                continue
            if value == "":
                ws.cell(row=row_idx, column=col_idx, value="")
                continue
            try:
                if "." in value:
                    ws.cell(row=row_idx, column=col_idx, value=float(value))
                else:
                    ws.cell(row=row_idx, column=col_idx, value=int(value))
            except ValueError:
                ws.cell(row=row_idx, column=col_idx, value=value)
    return wb


def _load_uploaded_workbook(path: Path, raw: bytes):
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        wb_f = load_workbook(BytesIO(raw), data_only=False)
        wb_v = load_workbook(BytesIO(raw), data_only=True)
        return wb_f, wb_v
    if suffix == ".csv":
        wb_f = _load_csv_workbook(raw)
        wb_v = _load_csv_workbook(raw)
        return wb_f, wb_v
    raise ValueError(f"unsupported file type: {suffix}")


def _registry_data() -> list[dict[str, Any]]:
    return [
        {
            "file_id": fid,
            "filename": entry["filename"],
            "path": entry["path"],
            "sheets": entry["sheets"],
        }
        for fid, entry in store.items()
    ]


def _save_registry() -> None:
    REGISTRY_PATH.write_text(json.dumps(_registry_data(), indent=2))


def _supported_suffix(path: Path) -> bool:
    return path.suffix.lower() in {".xlsx", ".csv"}


def _local_discovery_roots() -> list[Path]:
    override = get_config_value("EFT_LOCAL_DISCOVERY_ROOTS")
    if override:
        roots = [Path(part).expanduser() for part in override.split(os.pathsep) if part.strip()]
    else:
        home = Path.home()
        roots = [
            home / "Documents",
            home / "Desktop",
            home / "Downloads",
        ]
    deduped: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        resolved = root.expanduser()
        key = str(resolved)
        if key not in seen and resolved.exists():
            seen.add(key)
            deduped.append(resolved)
    return deduped


def _is_allowed_local_path(path: Path) -> bool:
    try:
        resolved = path.expanduser().resolve()
    except Exception:
        return False
    if not resolved.exists() or not resolved.is_file() or not _supported_suffix(resolved):
        return False
    for root in _local_discovery_roots():
        try:
            resolved.relative_to(root.resolve())
            return True
        except ValueError:
            continue
    return False


def _discover_local_files() -> list[dict[str, Any]]:
    blocked_dirs = {".git", "node_modules", ".next", "__pycache__", "Library"}
    discovered: list[dict[str, Any]] = []
    for root in _local_discovery_roots():
        if len(discovered) >= LOCAL_FILE_LIMIT:
            break
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [name for name in dirnames if not name.startswith(".") and name not in blocked_dirs]
            for filename in filenames:
                if filename.startswith("."):
                    continue
                path = Path(dirpath) / filename
                if not _supported_suffix(path):
                    continue
                try:
                    stat = path.stat()
                    discovered.append(
                        {
                            "path": str(path),
                            "filename": path.name,
                            "directory": str(path.parent),
                            "size_bytes": stat.st_size,
                            "modified_at": int(stat.st_mtime),
                        }
                    )
                except OSError:
                    continue
                if len(discovered) >= LOCAL_FILE_LIMIT:
                    break
            if len(discovered) >= LOCAL_FILE_LIMIT:
                break
    discovered.sort(key=lambda item: item["modified_at"], reverse=True)
    return discovered[:LOCAL_FILE_LIMIT]


def _ingest_local_file(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    wb_f, wb_v = _load_uploaded_workbook(path, raw)
    fid = uuid.uuid4().hex[:12]
    folder = UPLOADS_DIR / fid
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / path.name
    dest.write_bytes(raw)
    store[fid] = {
        "path": str(dest),
        "filename": path.name,
        "wb_f": wb_f,
        "wb_v": wb_v,
        "sheets": wb_f.sheetnames,
    }

    def _background_index():
        _build_ref_index(fid)

    threading.Thread(target=_background_index, daemon=True).start()
    _save_registry()
    return {"file_id": fid, "filename": path.name, "sheets": wb_f.sheetnames}


def _load_registry() -> None:
    if not REGISTRY_PATH.exists():
        return
    try:
        data = json.loads(REGISTRY_PATH.read_text())
    except Exception:
        return
    for item in data:
        fid = item.get("file_id")
        if not fid:
            continue
        workbook_path = Path(item.get("path", ""))
        folder = UPLOADS_DIR / fid
        if not workbook_path.exists() and folder.exists():
            matches = list(folder.glob("*.xlsx")) + list(folder.glob("*.csv"))
            workbook_path = matches[0] if matches else workbook_path
        if not workbook_path.exists():
            continue
        try:
            raw = workbook_path.read_bytes()
            wb_f, wb_v = _load_uploaded_workbook(workbook_path, raw)
        except Exception:
            continue
        store[fid] = {
            "path": str(workbook_path),
            "filename": workbook_path.name,
            "wb_f": wb_f,
            "wb_v": wb_v,
            "sheets": wb_f.sheetnames,
        }


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _file_or_404(fid: str) -> dict[str, Any]:
    entry = store.get(fid)
    if not entry:
        raise HTTPException(status_code=404, detail="file not found")
    return entry


def _sheet_or_404(entry: dict[str, Any], sheet: str):
    sheet_name = unquote(sheet)
    if sheet_name not in entry["wb_f"].sheetnames:
        raise HTTPException(status_code=404, detail="sheet not found")
    return sheet_name, entry["wb_f"][sheet_name], entry["wb_v"][sheet_name]


CELL_RE = re.compile(r"(?:(?:'[^']+'|[A-Za-z_][^!+]*)!)?\$?([A-Z]{1,3})\$?(\d{1,7})")
REF_RE = re.compile(r"(?:(?:'[^']+'|[A-Za-z0-9_ .-]+)!)?\$?[A-Z]{1,3}\$?\d{1,7}(?::\$?[A-Z]{1,3}\$?\d{1,7})?")


def _normalize_ref(token: str, current_sheet: str) -> tuple[str, str]:
    token = token.replace("$", "")
    if "!" in token:
        sheet_name, cell = token.split("!", 1)
        return sheet_name.strip("'"), cell
    return current_sheet, token


def _iter_formula_refs(formula: str | None, current_sheet: str) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    if not formula:
        return [], []
    cell_refs: list[tuple[str, str]] = []
    range_refs: list[tuple[str, str]] = []
    for match in REF_RE.finditer(formula):
        token = match.group(0)
        if token.startswith("["):
            continue
        if ":" in token:
            range_refs.append(_normalize_ref(token, current_sheet))
        else:
            cell_refs.append(_normalize_ref(token, current_sheet))
    dedup_cells = list(dict.fromkeys(cell_refs))
    dedup_ranges = list(dict.fromkeys(range_refs))
    return dedup_cells, dedup_ranges


def _cell_value(sheet_v, cell_ref: str) -> str:
    try:
        value = sheet_v[cell_ref].value
    except Exception:
        return "[bad ref]"
    return "" if value is None else str(value)


def _cell_formula(sheet_f, cell_ref: str) -> str | None:
    try:
        value = sheet_f[cell_ref].value
    except Exception:
        return None
    return value if isinstance(value, str) and value.startswith("=") else None


def _trace_node(entry: dict[str, Any], sheet: str, cell: str, path: set[str] | None = None, max_depth: int | None = None) -> dict[str, Any]:
    path = path or set()
    key = f"{sheet}!{cell}"
    if key in path:
        return {"cell": cell, "sheet": sheet, "value": "[circular]", "formula": None, "deps": [], "ranges": [], "external": False}
    if max_depth is not None and max_depth < 0:
        return {"cell": cell, "sheet": sheet, "value": "[max depth]", "formula": None, "deps": [], "ranges": [], "external": False}
    if sheet not in entry["wb_f"].sheetnames:
        return {"cell": cell, "sheet": sheet, "value": f"[sheet '{sheet}' not found]", "formula": None, "deps": [], "ranges": [], "external": False}
    sheet_f = entry["wb_f"][sheet]
    sheet_v = entry["wb_v"][sheet]
    formula = _cell_formula(sheet_f, cell)
    value = _cell_value(sheet_v, cell)
    deps: list[dict[str, Any]] = []
    ranges: list[dict[str, Any]] = []
    next_path = set(path)
    next_path.add(key)
    cell_refs, range_refs = _iter_formula_refs(formula, sheet)
    for ref_sheet, ref_cell in cell_refs:
        deps.append(_trace_node(entry, ref_sheet, ref_cell, next_path, None if max_depth is None else max_depth - 1))
    for range_sheet, range_ref in range_refs:
        headers = _range_headers(entry, range_sheet, range_ref)
        ranges.append({"sheet": range_sheet, "range": range_ref, "headers": headers})
    return {
        "cell": cell,
        "sheet": sheet,
        "value": value,
        "formula": formula,
        "deps": deps,
        "ranges": ranges,
        "external": bool(formula and "[" in formula),
    }


def _range_headers(entry: dict[str, Any], sheet: str, range_ref: str) -> list[str]:
    try:
        min_col, min_row, max_col, _ = range_boundaries(range_ref)
    except Exception:
        return []
    if sheet not in entry["wb_v"].sheetnames:
        return []
    ws = entry["wb_v"][sheet]
    headers: list[str] = []
    header_row = max(min_row - 1, 1)
    for col in range(min_col, max_col + 1):
        raw = ws.cell(row=header_row, column=col).value
        if raw is None:
            headers.append(get_column_letter(col))
        else:
            headers.append(str(raw))
    return headers


def _cell_in_range(cell: str, range_ref: str) -> bool:
    try:
        min_col, min_row, max_col, max_row = range_boundaries(range_ref)
        match = CELL_RE.fullmatch(cell)
        if not match:
            return False
        col_letters, row_str = match.groups()
        col_num = 0
        for ch in col_letters:
            col_num = col_num * 26 + (ord(ch) - 64)
        row_num = int(row_str)
        return min_col <= col_num <= max_col and min_row <= row_num <= max_row
    except Exception:
        return False


def _build_ref_index(fid: str) -> dict[str, list[tuple[str, str]]]:
    if fid in ref_index_cache:
        return ref_index_cache[fid]
    entry = _file_or_404(fid)
    index: dict[str, list[tuple[str, str]]] = {}
    for sheet_name in entry["wb_f"].sheetnames:
        ws = entry["wb_f"][sheet_name]
        for row in ws.iter_rows():
            for cell in row:
                formula = cell.value if isinstance(cell.value, str) and cell.value.startswith("=") else None
                if not formula:
                    continue
                refs, ranges = _iter_formula_refs(formula, sheet_name)
                for ref_sheet, ref_cell in refs:
                    index.setdefault(f"{ref_sheet}!{ref_cell}", []).append((sheet_name, cell.coordinate))
                for ref_sheet, range_ref in ranges:
                    index.setdefault(f"RANGE:{ref_sheet}!{range_ref}", []).append((sheet_name, cell.coordinate))
    ref_index_cache[fid] = index
    return index


def _trace_up(entry: dict[str, Any], fid: str, sheet: str, cell: str, path: set[str] | None = None) -> dict[str, Any]:
    path = path or set()
    key = f"{sheet}!{cell}"
    if key in path:
        return {"cell": cell, "sheet": sheet, "value": "[circular]", "formula": None, "deps": [], "ranges": [], "external": False}
    index = _build_ref_index(fid)
    direct = list(index.get(key, []))
    for idx_key, refs in index.items():
        if not idx_key.startswith("RANGE:"):
            continue
        range_target = idx_key[len("RANGE:") :]
        range_sheet, range_ref = range_target.split("!", 1)
        if range_sheet == sheet and _cell_in_range(cell, range_ref):
            direct.extend(refs)
    next_path = set(path)
    next_path.add(key)
    entry_node = _trace_node(entry, sheet, cell, set())
    entry_node["deps"] = [_trace_up(entry, fid, ref_sheet, ref_cell, next_path) for ref_sheet, ref_cell in dict.fromkeys(direct)]
    return entry_node


def _sheet_extent(ws) -> tuple[int, int]:
    max_row = min(ws.max_row or 1, 5000)
    max_col = min(ws.max_column or 1, 500)
    if max_row * max_col <= 200000:
        return max_row, max_col
    for row in range(max_row, max(1, max_row - 5000), -1):
        for col in range(max_col, max(1, max_col - 500), -1):
            if ws.cell(row=row, column=col).value not in (None, ""):
                return row, col
    return max_row, max_col


def _sheet_data(entry: dict[str, Any], fid: str, sheet: str) -> dict[str, Any]:
    cache_key = f"{fid}:{sheet}"
    if cache_key in sheet_cache:
        return sheet_cache[cache_key]
    ws_f = entry["wb_f"][sheet]
    ws_v = entry["wb_v"][sheet]
    max_row, max_col = _sheet_extent(ws_f)
    headers = [get_column_letter(c) for c in range(1, max_col + 1)]
    rows: list[list[dict[str, Any]]] = []
    for r in range(1, max_row + 1):
        row_data: list[dict[str, Any]] = []
        for c in range(1, max_col + 1):
            coord = f"{get_column_letter(c)}{r}"
            formula = _cell_formula(ws_f, coord)
            value = _cell_value(ws_v, coord)
            if formula is None and value == "":
                continue
            row_data.append({"r": coord, "v": value, "f": formula})
        rows.append(row_data)
    payload = {"headers": headers, "rows": rows}
    sheet_cache[cache_key] = payload
    return payload


def _detect_tables(entry: dict[str, Any], fid: str, sheet: str) -> list[dict[str, Any]]:
    cache_key = f"{fid}:{sheet}"
    if cache_key in tables_cache:
        return tables_cache[cache_key]
    ws = entry["wb_f"][sheet]
    occupied = {(cell.row, cell.column) for row in ws.iter_rows() for cell in row if cell.value not in (None, "")}
    seen: set[tuple[int, int]] = set()
    tables: list[dict[str, Any]] = []
    for node in list(occupied):
        if node in seen:
            continue
        queue = [node]
        component: list[tuple[int, int]] = []
        seen.add(node)
        while queue:
            r, c = queue.pop()
            component.append((r, c))
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if (nr, nc) in occupied and (nr, nc) not in seen:
                    seen.add((nr, nc))
                    queue.append((nr, nc))
        rows = [r for r, _ in component]
        cols = [c for _, c in component]
        min_row, max_row = min(rows), max(rows)
        min_col, max_col = min(cols), max(cols)
        row_count = max_row - min_row + 1
        col_count = max_col - min_col + 1
        cell_count = len(component)
        if cell_count < 8 or row_count < 3 or col_count < 2:
            continue
        preview: list[list[str]] = []
        formulas = numbers = texts = 0
        headers: list[str] = []
        for c in range(min_col, max_col + 1):
            head = ws.cell(row=min_row, column=c).value
            if isinstance(head, str):
                headers.append(head)
        for r in range(min_row, min(max_row, min_row + 3) + 1):
            preview_row: list[str] = []
            for c in range(min_col, max_col + 1):
                value = ws.cell(row=r, column=c).value
                if isinstance(value, str) and value.startswith("="):
                    formulas += 1
                elif isinstance(value, (int, float)):
                    numbers += 1
                elif value not in (None, ""):
                    texts += 1
                preview_row.append("" if value is None else str(value))
            preview.append(preview_row)
        table = {
            "range": f"{get_column_letter(min_col)}{min_row}:{get_column_letter(max_col)}{max_row}",
            "top_left": f"{get_column_letter(min_col)}{min_row}",
            "rows": row_count,
            "cols": col_count,
            "cells": cell_count,
            "formulas": formulas,
            "numbers": numbers,
            "texts": texts,
            "headers": headers,
            "has_header": bool(headers),
            "preview": preview,
        }
        tables.append(table)
    tables.sort(key=lambda item: (range_boundaries(item["range"])[1], range_boundaries(item["range"])[0]))
    tables = tables[:50]
    tables_cache[cache_key] = tables
    (UPLOADS_DIR / fid / f"tables_{sheet}.json").write_text(json.dumps(tables, indent=2))
    return tables


def _get_cell_label(entry: dict[str, Any], sheet: str, cell: str) -> str:
    ws = entry["wb_v"][sheet]
    match = CELL_RE.fullmatch(cell)
    if not match:
        return cell
    col_letters, row_text = match.groups()
    row_num = int(row_text)
    col_num = 0
    for ch in col_letters:
        col_num = col_num * 26 + (ord(ch) - 64)
    for c in range(col_num - 1, 0, -1):
        value = ws.cell(row=row_num, column=c).value
        if isinstance(value, str) and value.strip():
            return value.strip()
    header = ws.cell(row=1, column=col_num).value
    if isinstance(header, str) and header.strip():
        return header.strip()
    return f"{sheet}!{cell}"


def _formula_ref_count(formula: str | None, sheet: str) -> int:
    refs, ranges = _iter_formula_refs(formula, sheet)
    return len(refs) + len(ranges)


def _trace_to_text(node: dict[str, Any], depth: int = 0) -> str:
    indent = "    " * depth
    line = f"{indent}- {node['sheet']}!{node['cell']} | Formula: {node.get('formula')} | Value: {node.get('value')}"
    range_lines = [f"{indent}    Range: {rng['sheet']}!{rng['range']}" for rng in node.get("ranges", [])]
    child_lines = [_trace_to_text(dep, depth + 1) for dep in node.get("deps", [])]
    return "\n".join([line, *range_lines, *child_lines])


def _add_meta_to_trace(entry: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    node["meta"] = _get_cell_label(entry, node["sheet"], node["cell"])
    for dep in node.get("deps", []):
        _add_meta_to_trace(entry, dep)
    return node


def _collect_sheets(node: dict[str, Any], out: set[str] | None = None) -> list[str]:
    out = out or set()
    out.add(node["sheet"])
    for dep in node.get("deps", []):
        _collect_sheets(dep, out)
    return sorted(out)


def _build_formula_text(node: dict[str, Any], depth: int = 0) -> str:
    indent = "  " * depth
    label = node.get("meta") or f"{node['sheet']}!{node['cell']}"
    line = f"{indent}{label} = {node.get('formula') or node.get('value')}"
    children = [_build_formula_text(dep, depth + 1) for dep in node.get("deps", [])]
    return "\n".join([line, *children])


def _count_nodes(node: dict[str, Any]) -> tuple[int, int, set[str]]:
    total = 1
    formulas = 1 if node.get("formula") else 0
    sheets = {node["sheet"]}
    for dep in node.get("deps", []):
        child_total, child_formulas, child_sheets = _count_nodes(dep)
        total += child_total
        formulas += child_formulas
        sheets.update(child_sheets)
    return total, formulas, sheets


def _read_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


def _stream_llm(prompt_name: str, user_text: str, model: str, temperature: float, max_tokens: int) -> Generator[str, None, None]:
    prompt = _read_prompt(prompt_name)
    client = LLMClient(
        api_env=get_config_value("EFT_API_ENV") or "test",
        app_name=get_config_value("APP_NAME") or "excel-formula-tracer",
        aws_region=get_config_value("AWS_REGION") or "us-east-1",
    )
    try:
        stream = client.stream_openai(
            model=model,
            messages=[{"role": "user", "content": user_text}],
            system_prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        for chunk in stream:
            if isinstance(chunk, dict):
                yield _sse({"done": True, "usage": chunk})
            else:
                yield _sse({"text": chunk})
    except Exception as exc:
        yield _sse({"error": str(exc)})


@app.on_event("startup")
def startup() -> None:
    _load_registry()


@app.get("/ping")
def ping() -> dict[str, str]:
    return {"ok": "true"}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    async def event_stream():
        if not file.filename or not file.filename.lower().endswith((".xlsx", ".csv")):
            yield _sse({"error": "Only .xlsx and .csv files are supported"})
            return
        yield _sse({"progress": "Reading formulas..."})
        fid = uuid.uuid4().hex[:12]
        folder = UPLOADS_DIR / fid
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / file.filename
        raw = await file.read()
        path.write_bytes(raw)
        try:
            wb_f, wb_v = _load_uploaded_workbook(path, raw)
            yield _sse({"progress": f"Found {len(wb_f.sheetnames)} sheets — reading values..."})
        except Exception as exc:
            if path.exists():
                path.unlink()
            yield _sse({"error": f"Failed to parse workbook: {exc}"})
            return
        store[fid] = {
            "path": str(path),
            "filename": file.filename,
            "wb_f": wb_f,
            "wb_v": wb_v,
            "sheets": wb_f.sheetnames,
        }

        def _background_index():
            _build_ref_index(fid)

        threading.Thread(target=_background_index, daemon=True).start()
        _save_registry()
        yield _sse({"done": True, "file_id": fid, "filename": file.filename, "sheets": wb_f.sheetnames})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/local-files")
def local_files() -> list[dict[str, Any]]:
    return _discover_local_files()


@app.post("/api/local-files/import")
async def import_local_file(payload: dict[str, Any]) -> dict[str, Any]:
    raw_path = payload.get("path")
    if not raw_path:
        raise HTTPException(status_code=400, detail="path is required")
    path = Path(str(raw_path)).expanduser()
    if not _is_allowed_local_path(path):
        raise HTTPException(status_code=403, detail="path is not within allowed local discovery roots")
    try:
        return _ingest_local_file(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to import local file: {exc}") from exc


@app.get("/api/files")
def files() -> list[dict[str, Any]]:
    return [{"file_id": fid, "filename": entry["filename"], "sheets": entry["sheets"]} for fid, entry in store.items()]


@app.get("/api/files/{fid}")
def file_detail(fid: str) -> dict[str, Any]:
    entry = _file_or_404(fid)
    return {"file_id": fid, "filename": entry["filename"], "sheets": entry["sheets"]}


@app.delete("/api/files/{fid}")
def delete_file(fid: str) -> dict[str, bool]:
    store.pop(fid, None)
    ref_index_cache.pop(fid, None)
    for key in [key for key in list(sheet_cache) if key.startswith(f"{fid}:")]:
        sheet_cache.pop(key, None)
    for key in [key for key in list(tables_cache) if key.startswith(f"{fid}:")]:
        tables_cache.pop(key, None)
    shutil.rmtree(UPLOADS_DIR / fid, ignore_errors=True)
    _save_registry()
    return {"ok": True}


@app.get("/api/sheet/{fid}/{sheet:path}")
def get_sheet(fid: str, sheet: str) -> dict[str, Any]:
    entry = _file_or_404(fid)
    sheet_name, _, _ = _sheet_or_404(entry, sheet)
    return _sheet_data(entry, fid, sheet_name)


@app.get("/api/sheet-stream/{fid}/{sheet:path}")
def get_sheet_stream(fid: str, sheet: str):
    entry = _file_or_404(fid)
    sheet_name, ws_f, _ = _sheet_or_404(entry, sheet)

    def event_stream():
        max_row, max_col = _sheet_extent(ws_f)
        yield _sse({"progress": f"Reading {max_row} rows x {max_col} columns"})
        data = _sheet_data(entry, fid, sheet_name)
        yield _sse({"done": True, "data": data})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/trace")
async def trace(payload: dict[str, Any]) -> dict[str, Any]:
    entry = _file_or_404(payload["file_id"])
    return _trace_node(entry, payload["sheet"], payload["cell"], set())


@app.post("/api/trace-up")
async def trace_up(payload: dict[str, Any]) -> dict[str, Any]:
    entry = _file_or_404(payload["file_id"])
    return _trace_up(entry, payload["file_id"], payload["sheet"], payload["cell"], set())


@app.post("/api/table-trace")
async def table_trace(payload: dict[str, Any]) -> dict[str, Any]:
    entry = _file_or_404(payload["file_id"])
    sheet = payload["sheet"]
    range_ref = payload["range"]
    try:
        min_col, min_row, max_col, max_row = range_boundaries(range_ref)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid range format")
    metrics: list[dict[str, Any]] = []
    cache: dict[str, dict[str, Any]] = {}
    ws = entry["wb_f"][sheet]
    total_formulas = 0
    total_deps = 0
    for row in range(min_row, max_row + 1):
        label = None
        cells: list[dict[str, Any]] = []
        for col in range(min_col, max_col + 1):
            coord = f"{get_column_letter(col)}{row}"
            raw = ws[coord].value
            if isinstance(raw, str) and raw.startswith("="):
                total_formulas += 1
                if coord not in cache:
                    cache[coord] = _trace_node(entry, sheet, coord, set(), MAX_DEPTH)
                cells.append(cache[coord])
            elif label is None and isinstance(raw, str) and raw.strip():
                label = raw.strip()
        if cells:
            metrics.append({"label": label or f"Metric {row}", "cells": cells})
            total_deps += sum(len(cell.get("deps", [])) for cell in cells)
    return {"metrics": metrics, "total_formulas": total_formulas, "total_deps": total_deps}


@app.get("/api/tables/{fid}/{sheet:path}")
def tables(fid: str, sheet: str) -> list[dict[str, Any]]:
    entry = _file_or_404(fid)
    sheet_name, _, _ = _sheet_or_404(entry, sheet)
    return _detect_tables(entry, fid, sheet_name)


@app.put("/api/tables/{fid}/{sheet:path}")
async def save_tables(fid: str, sheet: str, payload: dict[str, Any]) -> dict[str, Any]:
    sheet_name = unquote(sheet)
    cache_key = f"{fid}:{sheet_name}"
    tables_cache[cache_key] = payload.get("tables", [])
    (UPLOADS_DIR / fid / f"tables_{sheet_name}.json").write_text(json.dumps(tables_cache[cache_key], indent=2))
    return {"ok": True}


@app.get("/api/top-metrics/{fid}")
def top_metrics(fid: str, sheets: str | None = None, min_depth: int = 2) -> dict[str, Any]:
    entry = _file_or_404(fid)
    selected = sheets.split(",") if sheets else entry["sheets"]
    index = _build_ref_index(fid)
    referenced: set[str] = {key for key in index if not key.startswith("RANGE:")}
    for key in index:
        if key.startswith("RANGE:"):
            target = key[len("RANGE:") :]
            sheet_name, range_ref = target.split("!", 1)
            try:
                min_col, min_row, max_col, max_row = range_boundaries(range_ref)
            except Exception:
                continue
            count = 0
            for row in range(min_row, max_row + 1):
                for col in range(min_col, max_col + 1):
                    referenced.add(f"{sheet_name}!{get_column_letter(col)}{row}")
                    count += 1
                    if count >= 100000:
                        break
                if count >= 100000:
                    break
    metrics: list[dict[str, Any]] = []
    for sheet_name in selected:
        if sheet_name not in entry["wb_f"].sheetnames:
            continue
        ws_f = entry["wb_f"][sheet_name]
        ws_v = entry["wb_v"][sheet_name]
        max_row, max_col = _sheet_extent(ws_f)
        for row in range(1, max_row + 1):
            for col in range(1, max_col + 1):
                coord = f"{get_column_letter(col)}{row}"
                formula = _cell_formula(ws_f, coord)
                if not formula:
                    continue
                if f"{sheet_name}!{coord}" in referenced:
                    continue
                if _formula_ref_count(formula, sheet_name) < min_depth:
                    continue
                metrics.append(
                    {
                        "sheet": sheet_name,
                        "cell": coord,
                        "label": _get_cell_label(entry, sheet_name, coord),
                        "formula": formula,
                        "value": _cell_value(ws_v, coord),
                    }
                )
    return {"metrics": metrics, "total": len(metrics)}


@app.post("/api/top-metrics/{fid}/trace/{sheet:path}/{cell}")
def top_metric_trace(fid: str, sheet: str, cell: str) -> dict[str, Any]:
    entry = _file_or_404(fid)
    sheet_name = unquote(sheet)
    trace = _trace_node(entry, sheet_name, cell, set())
    enriched = _add_meta_to_trace(entry, trace)
    return {
        "trace": enriched,
        "sheets_involved": _collect_sheets(enriched),
        "formula_text": _build_formula_text(enriched),
    }


@app.post("/api/explain")
async def explain(payload: dict[str, Any]):
    trace_text = _trace_to_text(payload["trace"])
    user_text = f"Here is the full dependency tree for the formula:\n\n{trace_text}\n\nPlease explain this formula in plain English."
    model = payload.get("model", get_config_value("SCRIPT_JUDGE_MODEL") or "gpt-5.1-2025-11-13")
    return StreamingResponse(_stream_llm("explain_formula.txt", user_text, model, 0.2, 2000), media_type="text/event-stream")


@app.post("/api/business-summary")
async def business_summary(payload: dict[str, Any]):
    trace_text = _trace_to_text(payload["trace"])
    user_text = f"Here is the full dependency tree for the metric:\n\n{trace_text}\n\nExplain this metric from a business perspective."
    model = payload.get("model", get_config_value("SCRIPT_JUDGE_MODEL") or "gpt-5.1-2025-11-13")
    return StreamingResponse(_stream_llm("business_summary.txt", user_text, model, 0.2, 2000), media_type="text/event-stream")


@app.post("/api/table-explain-batch")
async def table_explain_batch(payload: dict[str, Any]):
    model = payload.get("model", get_config_value("SCRIPT_JUDGE_MODEL") or "gpt-5.1-2025-11-13")

    def event_stream():
        for idx, metric in enumerate(payload.get("metrics", [])):
            yield _sse({"metric_index": idx, "type": "analyst", "status": "start"})
            trace_text = _trace_to_text(metric["trace"])
            for event in _stream_llm("explain_formula.txt", f"Here is the full dependency tree for the formula:\n\n{trace_text}\n\nPlease explain this formula in plain English.", model, 0.2, 2000):
                if '"done": true' in event.lower():
                    continue
                data = json.loads(event[6:])
                if "text" in data:
                    yield _sse({"metric_index": idx, "type": "analyst", "text": data["text"]})
            yield _sse({"metric_index": idx, "type": "analyst", "status": "done"})
        yield _sse({"all_done": True})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/top-metrics/explain-all")
async def top_metrics_explain_all(payload: dict[str, Any]):
    model = payload.get("model", get_config_value("SCRIPT_JUDGE_MODEL") or "gpt-5.1-2025-11-13")

    def event_stream():
        for idx, metric in enumerate(payload.get("metrics", [])):
            trace = metric["trace"]
            trace_text = _trace_to_text(trace)
            for kind, prompt_name, user_text in (
                ("analyst", "explain_formula.txt", f"Here is the full dependency tree for the formula:\n\n{trace_text}\n\nPlease explain this formula in plain English."),
                ("business", "business_summary.txt", f"Here is the full dependency tree for the metric:\n\n{trace_text}\n\nExplain this metric from a business perspective."),
            ):
                yield _sse({"metric_index": idx, "type": kind, "status": "start"})
                full_text = ""
                for event in _stream_llm(prompt_name, user_text, model, 0.2, 2000):
                    data = json.loads(event[6:])
                    if "text" in data:
                        full_text += data["text"]
                        yield _sse({"metric_index": idx, "type": kind, "text": data["text"]})
                yield _sse({"metric_index": idx, "type": kind, "status": "done", "full_text": full_text})
        yield _sse({"all_done": True})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/optimize")
async def optimize(payload: dict[str, Any]):
    trace = payload["trace"]
    total_nodes, formula_count, sheets = _count_nodes(trace)
    trace_text = _trace_to_text(trace)
    user_text = (
        f"Metric: {payload.get('label', 'Metric')}\n"
        f"Stats: {total_nodes} nodes, {formula_count} formulas, {len(sheets)} sheets ({', '.join(sorted(sheets))})\n\n"
        f"Full dependency tree:\n\n{trace_text}\n\n"
        "Analyze this formula tree and determine if it can be optimized."
    )
    model = payload.get("model", get_config_value("SCRIPT_JUDGE_MODEL") or "gpt-5.1-2025-11-13")

    def event_stream():
        buffer = ""
        for event in _stream_llm("optimize_formula.txt", user_text, model, 0.3, 4000):
            data = json.loads(event[6:])
            if "text" in data:
                buffer += data["text"]
                yield _sse({"text": data["text"]})
            elif "error" in data:
                yield _sse(data)
        match = re.search(r"```json\s*(\{.*\})\s*```", buffer, re.S)
        if not match:
            match = re.search(r"(\{.*\})\s*$", buffer, re.S)
        result = {"verdict": "keep", "reason": "Could not parse optimization result."}
        if match:
            try:
                result = json.loads(match.group(1))
            except Exception:
                pass
        if result.get("verdict") not in {"keep", "optimize"}:
            result = {"verdict": "keep", "reason": "Optimization verdict was invalid."}
        if result.get("verdict") == "optimize":
            tree = result.setdefault("optimized_tree", trace)
            tree.setdefault("ranges", [])
            tree.setdefault("deps", [])
        yield _sse({"result": result, "done": True})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
