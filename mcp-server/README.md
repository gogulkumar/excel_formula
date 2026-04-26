# CalcSense MCP Server

This folder contains a lightweight MCP server that exposes core CalcSense workbook operations to MCP-compatible clients such as Claude Desktop or Codex-compatible MCP tooling.

## What it does

The server connects to a running CalcSense backend and exposes these tools:

- `ping`
- `list_workbooks`
- `get_workbook`
- `get_sheet`
- `trace_formula`
- `trace_upstream`
- `list_tables`
- `top_metrics`

## Requirements

- Python 3.10+
- A running CalcSense backend

Default backend URL:

- `http://localhost:8010`

Override it with:

```bash
export CALCSENSE_API_BASE="https://your-backend.example.com"
```

## Run locally

```bash
python3 mcp-server/server.py
```

The server uses stdio and is meant to be launched by an MCP client, not directly in a browser.

## Claude Desktop example

Add this to your MCP configuration:

```json
{
  "mcpServers": {
    "calcsense": {
      "command": "python3",
      "args": ["/absolute/path/to/excel_formula/mcp-server/server.py"],
      "env": {
        "CALCSENSE_API_BASE": "http://localhost:8010"
      }
    }
  }
}
```

## Notes

- The MCP server does not store workbook data itself.
- It forwards tool calls to the CalcSense backend API.
- For public deployment, point `CALCSENSE_API_BASE` at your hosted backend URL.
