# CalcSense

> **Turn any Excel workbook into an interactive intelligence platform — understand formulas, trace dependencies, and get AI-powered explanations in seconds.**

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

---

## What is CalcSense?

Finance teams, analysts, and transformation leads spend countless hours reverse-engineering Excel models they inherited. CalcSense eliminates that friction.

Upload any `.xlsx` workbook and instantly get:

- **A full dependency map** — trace any cell upstream or downstream across sheets
- **AI explanations** — technical breakdowns for analysts, plain-English summaries for executives
- **Auto-detected tables and metrics** — understand your model's structure at a glance
- **Live editing** — modify cells, apply formatting, and insert charts without leaving the browser

No more digging through 20 sheets to understand where a number came from.

---

## Screenshots

> _Upload your workbook → browse sheets → click any cell → get an instant dependency graph and AI explanation._

| Landing | Workbook View | Formula Trace | AI Explanation |
|---|---|---|---|
| _(animated onboarding)_ | _(sheet grid + sidebar)_ | _(DAG graph)_ | _(markdown panel)_ |

---

## Key Features

### Workbook Intelligence
- Upload and persist `.xlsx` files (up to 200 MB)
- Survives server restarts — workbooks reload from disk automatically
- Stream large sheet data progressively for snappy load times
- Download modified workbooks after editing

### Formula Tracing
- **Downstream trace** — follow what a cell feeds into
- **Upstream trace** — find every cell that contributes to a value
- Cross-sheet dependency tracking
- Circular reference detection
- Top-level metric discovery (formulas referenced by nothing — your true outputs)

### Table & Metric Analysis
- Auto-detect table regions using connected-component analysis
- Trace all metrics within a selected table range
- Manual table boundary overrides
- Top-50 tables surfaced per sheet

### AI-Powered Explanations
- **Technical explanation** — formula logic for data analysts and modelers
- **Business summary** — executive-ready narrative of what a metric represents
- **Formula blueprint** — reconstruction and optimization suggestions
- **Optimization analysis** — AI verdict on formula efficiency
- **Batch explain** — stream explanations for all metrics in a table at once
- Persona inference: responses automatically adapt to analyst, data, or business context
- Full mock mode for development without LLM credentials

### Conversational Chat
- Multi-turn AI chat with workbook context
- Ask questions about any cell, table, or sheet
- Auto-detects your intent (formula mechanics vs. business trends vs. executive narrative)
- Prompt injection and jailbreak protection built in

### Cell Editing & Formatting
- Edit values and formulas directly (up to 200 cells per request)
- Apply colors, bold, italic, number formats
- Insert charts: Bar, Pie, Line, Scatter, Area
- Per-file locking for safe concurrent edits

### Async Streaming
- All long-running AI tasks stream via SSE — no page freezes
- Client reconnection support for large workbooks
- Task cancellation and auto-cleanup
- Result caching prevents duplicate LLM calls

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser (Next.js)              │
│  Landing → Sheet Browser → Analysis Workspace  │
│  Formula Graph · Trace Tree · Chat · Editor     │
└───────────────────┬─────────────────────────────┘
                    │  REST + SSE
┌───────────────────▼─────────────────────────────┐
│              FastAPI Backend (Python)           │
│  Upload · Parse · Trace · Table Detection       │
│  LLM Orchestration · Task Streaming · Edit      │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
   ┌────▼────┐           ┌──────▼──────┐
   │  openpyxl│           │  LLM Client │
   │  (XLSX) │           │  OpenAI /   │
   └─────────┘           │  Bedrock    │
                         └─────────────┘
```

**Backend:** Python 3.12 · FastAPI · Uvicorn · openpyxl · httpx · boto3  
**Frontend:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · @xyflow/react · dagre

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- `make`

### 1. Clone & Install

```bash
git clone https://github.com/gogulkumar/excel_formula.git
cd excel_formula
make setup
```

This creates a Python virtual environment, installs all backend dependencies, and installs frontend packages.

### 2. Configure Environment

```bash
cp app/.env.example app/.env
```

**Minimal config for local development (no LLM credentials needed):**

```env
EFT_RUNTIME=local
EFT_API_ENV=test
EFT_LLM_MODE=mock
NEXT_PUBLIC_API_URL=http://localhost:8000
APP_NAME=calcsense
AWS_REGION=us-east-1
```

**For live AI features via OpenAI-compatible proxy:**

```env
EFT_LLM_MODE=live
EFT_OPENAI_PROXY_URL=https://your-proxy.example.com/v1/proxy/azure-openai
EFT_PROXY_AUTH_TOKEN=Basic YOUR_TOKEN
```

**For AWS Bedrock:**

```env
EFT_LLM_MODE=live
EFT_BEDROCK_PROXY_URL=https://your-proxy.example.com/v1/proxy/bedrock
EFT_PROXY_AUTH_TOKEN=Basic YOUR_TOKEN
AWS_REGION=us-east-1
```

> Never commit secrets. All sensitive values belong in `.env` which is gitignored.

### 3. Run

```bash
make start
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

**Custom ports:**

```bash
make start BACKEND_PORT=8010 FRONTEND_PORT=3001 NEXT_PUBLIC_API_URL=http://localhost:8010
```

**Stop servers:**

```bash
make stop
```

---

## Validation

```bash
# Smoke test suite
make test

# Frontend production build check
cd app/frontend && npm run build

# Backend import check
.venv/bin/python -m py_compile app/config_loader.py app/llm_client.py app/backend/main.py
```

## MCP Server

A downloadable MCP server is included in:

```text
mcp-server/
```

See:

- [mcp-server/README.md](/Users/gogulkumar/Documents/Codex/2026-04-25-can-you-clone-htis-rpeo-in/excel_formula/mcp-server/README.md)

It exposes core workbook tools by forwarding requests to the CalcSense backend.

## Current Status

CalcSense is a strong working foundation, but it is not yet fully production-ready for unrestricted public deployment.

Implemented and working in the current branch:

- Workbook upload, persistence, reload, and download
- Sheet browsing with streamed loading
- Dependency tracing, reverse tracing, table analysis, and top-level metric discovery
- Technical explanations, business summaries, blueprints, snapshots, and optimization flows
- Task-based AI streaming with reconnect support
- Chat, cell editing, formatting, and chart insertion APIs
- CalcSense-branded frontend with animated landing experience and workbook analysis workspace

Still in progress before we can claim full production readiness:

- Full end-to-end validation of every live LLM path against production credentials
- Additional UX polish in some advanced panels and interaction details
- Broader automated regression coverage
- Audio transcription support described in the target PRD
- Authentication, multi-user isolation, and durable shared storage for public launch

## API Reference

### File Lifecycle
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload an XLSX workbook (SSE progress stream) |
| `GET` | `/api/files` | List all workbooks |
| `GET` | `/api/files/{fid}` | Get workbook metadata |
| `DELETE` | `/api/files/{fid}` | Remove workbook |
| `GET` | `/api/download/{fid}` | Download (modified) workbook |

### Workbook Data
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sheet/{fid}/{sheet}` | Full sheet data |
| `GET` | `/api/sheet-stream/{fid}/{sheet}` | Streamed sheet loading |
| `POST` | `/api/reload/{fid}` | Reload from disk, clear caches |
| `GET` | `/api/tables/{fid}/{sheet}` | Auto-detected table regions |
| `PUT` | `/api/tables/{fid}/{sheet}` | Save custom table definitions |

### Tracing & Metrics
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/trace` | Downstream dependency trace |
| `POST` | `/api/trace-up` | Upstream reference trace |
| `POST` | `/api/table-trace` | Trace metrics within a table |
| `GET` | `/api/top-metrics/{fid}` | Discover top-level output metrics |
| `POST` | `/api/top-metrics/{fid}/trace/{sheet}/{cell}` | Full trace for a metric |

### AI Flows
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/explain` | Technical formula explanation |
| `POST` | `/api/business-summary` | Executive business summary |
| `POST` | `/api/reconstruct` | Formula reconstruction |
| `POST` | `/api/snapshot` | Concise formula snapshot |
| `POST` | `/api/optimize` | Optimization analysis |
| `POST` | `/api/table-explain-batch` | Batch explain all table metrics (SSE) |
| `POST` | `/api/top-metrics/explain-all` | Batch explain all top metrics (SSE) |
| `POST` | `/api/chat` | Conversational workbook analysis |

### Task Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/task/{task_id}` | Poll task status |
| `GET` | `/api/task/{task_id}/stream` | Stream task output (SSE) |
| `POST` | `/api/task/{task_id}/cancel` | Cancel a running task |

### Editing
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/edit-cells` | Modify cell values/formulas |
| `POST` | `/api/format-cells` | Apply cell formatting |
| `POST` | `/api/insert-chart` | Insert a chart |

---

## Repository Structure

```
excel_formula/
├── app/
│   ├── backend/
│   │   ├── main.py              # All FastAPI routes and core logic
│   │   └── uploads/             # Persisted workbooks and metadata
│   ├── frontend/
│   │   └── src/
│   │       ├── app/             # Next.js pages
│   │       └── components/      # React components
│   ├── prompts/                 # LLM system prompt templates
│   ├── config_loader.py         # Environment configuration
│   └── llm_client.py            # LLM abstraction (OpenAI / Bedrock)
├── scripts/
│   ├── start.sh                 # Server startup script
│   └── smoke_test.py            # End-to-end smoke tests
├── Makefile
├── requirements.txt
└── README.md
```

---

## Operational Notes

- Workbooks are stored at `app/backend/uploads/{file_id}/`
- Registry metadata lives at `app/backend/uploads/registry.json`
- Explanation cache persists at `{file_id}/explanations.json`
- Table definitions persist at `{file_id}/tables_{sheet}.json`
- LLM tasks auto-expire 10 minutes after completion

### Limits

| Parameter | Limit |
|---|---|
| Max upload size | 200 MB |
| Sheet extent | 5,000 rows × 500 columns |
| Cells per edit request | 200 |
| Trace depth (default) | 5 levels |
| Tables detected per sheet | 50 |
| Task retention | 10 minutes |

---

## Roadmap

- [ ] Full end-to-end validation of live LLM proxy integrations
- [ ] Expanded automated regression coverage (backend + frontend)
- [ ] Audio transcription support (Whisper integration)
- [ ] Advanced UX polish across detailed interaction states
- [ ] Role-based access control for multi-user deployments
- [ ] Export explanations to PDF / Word

---

## Deployment and Security Docs

- [DEPLOY_VERCEL.md](/Users/gogulkumar/Documents/Codex/2026-04-25-can-you-clone-htis-rpeo-in/excel_formula/DEPLOY_VERCEL.md)
- [SECURITY.md](/Users/gogulkumar/Documents/Codex/2026-04-25-can-you-clone-htis-rpeo-in/excel_formula/SECURITY.md)

## Contributing

This project is under active development.

- Keep ports configurable via environment variables
- Run `make test` after backend changes
- Run `npm run build` to validate the frontend before pushing
- Do not commit `.env` or any credential files
- Prefer small, focused PRs

---

## License

Proprietary — all rights reserved. No license has been granted for external use, modification, or distribution.
