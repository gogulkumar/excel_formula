#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


API_BASE = os.environ.get("CALCSENSE_API_BASE", "http://localhost:8010").rstrip("/")
SERVER_NAME = "calcsense-mcp"
SERVER_VERSION = "0.1.0"


TOOLS = [
    {
        "name": "ping",
        "description": "Check whether the CalcSense backend is reachable.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "list_workbooks",
        "description": "List uploaded workbooks currently loaded by CalcSense.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_workbook",
        "description": "Get metadata for one workbook.",
        "inputSchema": {
            "type": "object",
            "properties": {"file_id": {"type": "string"}},
            "required": ["file_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_sheet",
        "description": "Fetch workbook sheet data.",
        "inputSchema": {
            "type": "object",
            "properties": {"file_id": {"type": "string"}, "sheet": {"type": "string"}},
            "required": ["file_id", "sheet"],
            "additionalProperties": False,
        },
    },
    {
        "name": "trace_formula",
        "description": "Trace downstream dependencies for a formula cell.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file_id": {"type": "string"},
                "sheet": {"type": "string"},
                "cell": {"type": "string"},
                "max_depth": {"type": "integer", "default": 5},
            },
            "required": ["file_id", "sheet", "cell"],
            "additionalProperties": False,
        },
    },
    {
        "name": "trace_upstream",
        "description": "Trace reverse dependencies for a cell.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file_id": {"type": "string"},
                "sheet": {"type": "string"},
                "cell": {"type": "string"},
                "max_depth": {"type": "integer", "default": 5},
            },
            "required": ["file_id", "sheet", "cell"],
            "additionalProperties": False,
        },
    },
    {
        "name": "list_tables",
        "description": "List detected tables for a sheet.",
        "inputSchema": {
            "type": "object",
            "properties": {"file_id": {"type": "string"}, "sheet": {"type": "string"}},
            "required": ["file_id", "sheet"],
            "additionalProperties": False,
        },
    },
    {
        "name": "top_metrics",
        "description": "List top-level metrics in a workbook.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file_id": {"type": "string"},
                "sheets": {"type": "array", "items": {"type": "string"}},
                "min_refs": {"type": "integer", "default": 2},
            },
            "required": ["file_id"],
            "additionalProperties": False,
        },
    },
]


def _read_message() -> dict[str, Any] | None:
    headers: dict[str, str] = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        if line in (b"\r\n", b"\n"):
            break
        key, _, value = line.decode("utf-8").partition(":")
        headers[key.strip().lower()] = value.strip()
    length = int(headers.get("content-length", "0"))
    if length <= 0:
        return None
    body = sys.stdin.buffer.read(length)
    return json.loads(body.decode("utf-8"))


def _write_message(payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(encoded)}\r\n\r\n".encode("utf-8"))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def _request_json(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    url = f"{API_BASE}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{exc.code} {exc.reason}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Failed to reach CalcSense backend at {url}: {exc.reason}") from exc


def _tool_result(data: Any) -> dict[str, Any]:
    return {
        "content": [
            {
                "type": "text",
                "text": json.dumps(data, indent=2, ensure_ascii=True),
            }
        ]
    }


def _call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "ping":
        return _tool_result(_request_json("GET", "/ping"))
    if name == "list_workbooks":
        return _tool_result(_request_json("GET", "/api/files"))
    if name == "get_workbook":
        return _tool_result(_request_json("GET", f"/api/files/{arguments['file_id']}"))
    if name == "get_sheet":
        sheet = urllib.parse.quote(arguments["sheet"], safe="")
        return _tool_result(_request_json("GET", f"/api/sheet/{arguments['file_id']}/{sheet}"))
    if name == "trace_formula":
        payload = {
            "file_id": arguments["file_id"],
            "sheet": arguments["sheet"],
            "cell": arguments["cell"],
            "max_depth": int(arguments.get("max_depth", 5)),
        }
        return _tool_result(_request_json("POST", "/api/trace", payload))
    if name == "trace_upstream":
        payload = {
            "file_id": arguments["file_id"],
            "sheet": arguments["sheet"],
            "cell": arguments["cell"],
            "max_depth": int(arguments.get("max_depth", 5)),
        }
        return _tool_result(_request_json("POST", "/api/trace-up", payload))
    if name == "list_tables":
        sheet = urllib.parse.quote(arguments["sheet"], safe="")
        return _tool_result(_request_json("GET", f"/api/tables/{arguments['file_id']}/{sheet}"))
    if name == "top_metrics":
        params = urllib.parse.urlencode(
            {
                "sheets": ",".join(arguments.get("sheets", [])),
                "min_refs": int(arguments.get("min_refs", 2)),
            }
        )
        return _tool_result(_request_json("GET", f"/api/top-metrics/{arguments['file_id']}?{params}"))
    raise RuntimeError(f"Unknown tool: {name}")


def _handle(request: dict[str, Any]) -> dict[str, Any] | None:
    method = request.get("method")
    request_id = request.get("id")
    params = request.get("params") or {}

    if method == "notifications/initialized":
        return None
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                "capabilities": {"tools": {}},
            },
        }
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}
    if method == "tools/call":
        try:
            result = _call_tool(str(params.get("name", "")), params.get("arguments") or {})
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except Exception as exc:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32000, "message": str(exc)},
            }
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    }


def main() -> int:
    while True:
        message = _read_message()
        if message is None:
            return 0
        response = _handle(message)
        if response is not None:
            _write_message(response)


if __name__ == "__main__":
    raise SystemExit(main())
