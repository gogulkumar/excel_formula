# Excel Formula Tracer

Excel Formula Tracer is a web application for understanding complex `.xlsx` workbooks and `.csv` datasets without manually reverse-engineering them in Excel. It uploads a workbook, parses formulas and computed values, traces dependency chains across sheets, visualizes them as interactive graphs, and generates AI-assisted explanations for analysts and business stakeholders.

## Why This Exists

Spreadsheet models accumulate logic over time:

- Metrics are built through long formula chains
- References jump across tabs and helper sheets
- Audit and handoff become slow because the logic lives inside the workbook

This project turns that logic into a browsable application.

## Current Status

This repository now includes a working MVP foundation with:

- FastAPI backend for workbook upload, parsing, tracing, table detection, and metric discovery
- Next.js frontend for upload, sheet browsing, tracing, and table analysis flows
- SSE streaming support for long-running backend and AI responses
- Configurable LLM proxy integration with a local mock mode for development
- Smoke test coverage for the main workbook lifecycle

Still in progress:

- Final production polish across all views
- Full PRD parity for every backend edge case and UI state
- Real LLM proxy credentials and live provider validation
- Audio transcription support
- Broader automated test coverage

## Features

### Workbook ingestion

- Upload `.xlsx` and `.csv` files
- Persist uploads and registry metadata on disk
- Restore previously uploaded files on server restart
- Load both formula and computed-value workbook variants

### Formula tracing

- Trace dependencies downstream from any formula cell
- Trace upstream usage with reverse reference lookup
- Detect cross-sheet references
- Detect circular references
- Surface range references alongside direct cell references

### Workbook analysis

- Stream sheet loading for larger workbooks
- Detect table-like regions in sheets
- Trace metrics within a selected table region
- Discover top-level metrics that are not referenced by any other formula

### AI-assisted outputs

- Technical explanations for analyst audiences
- Business summaries for executive audiences
- Batch explanation flows for metrics
- Optimization analysis endpoint with structured result parsing
- Local mock mode for development without live proxy access

## Tech Stack

### Backend

- Python 3.12+
- FastAPI
- Uvicorn
- openpyxl
- httpx

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- React Flow (`@xyflow/react`)
- dagre
- react-markdown

### LLM integration

- OpenAI-compatible proxy path for Azure OpenAI
- Bedrock-compatible proxy path for Claude-style requests
- Environment-driven config
- Mock fallback mode for local development

## Project Structure

```text
excel_formula/
├── app/
│   ├── backend/
│   │   ├── main.py
│   │   └── uploads/
│   ├── frontend/
│   │   ├── package.json
│   │   └── src/
│   ├── certificates/
│   ├── prompts/
│   ├── config_loader.py
│   └── llm_client.py
├── scripts/
│   ├── start.sh
│   └── smoke_test.py
├── Makefile
├── requirements.txt
└── README.md
```

## Getting Started

### 1. Install dependencies

```bash
make setup
```

This creates the Python virtual environment, installs backend dependencies, and installs frontend packages.

### 2. Configure environment

Copy the example config:

```bash
cp app/.env.example app/.env
```

At minimum, set values for your preferred development mode.

For local development without a real LLM proxy, you can use:

```env
EFT_RUNTIME=local
EFT_API_ENV=test
EFT_LLM_MODE=mock
NEXT_PUBLIC_API_URL=http://localhost:8010
APP_NAME=excel-formula-tracer
AWS_REGION=us-east-1
```

If you have a real proxy, configure one of:

```env
LLM_PROXY_HOST=your-proxy-host.example.com
LLM_PROXY_SCHEME=https
EFT_PROXY_AUTH_TOKEN=Basic YOUR_TOKEN
```

or explicit URLs:

```env
EFT_OPENAI_PROXY_URL=https://your-host.example.com/v1/proxy/azure-openai
EFT_BEDROCK_PROXY_URL=https://your-host.example.com/v1/proxy/bedrock
EFT_PROXY_AUTH_TOKEN=Basic YOUR_TOKEN
```

## Running Locally

The Makefile supports configurable ports.

If port `8000` is already used on your machine, start the app like this:

```bash
make start BACKEND_PORT=8010 FRONTEND_PORT=3001 NEXT_PUBLIC_API_URL=http://localhost:8010
```

Default local ports:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

Alternate ports used during development in this repo:

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:8010`

To stop the local servers:

```bash
make stop
```

## Testing

Run the smoke test:

```bash
make test
```

What it does:

- starts the backend in mock LLM mode
- generates a real temporary workbook
- uploads it through the API
- validates sheet streaming, trace down, trace up, table detection, table trace, and top-metric endpoints
- exercises AI endpoints in mock mode
- deletes the uploaded workbook

## Key API Endpoints

### File lifecycle

- `POST /api/upload`
- `GET /api/files`
- `GET /api/files/{fid}`
- `DELETE /api/files/{fid}`

### Workbook data

- `GET /api/sheet/{fid}/{sheet}`
- `GET /api/sheet-stream/{fid}/{sheet}`
- `GET /api/tables/{fid}/{sheet}`
- `PUT /api/tables/{fid}/{sheet}`

### Tracing and metrics

- `POST /api/trace`
- `POST /api/trace-up`
- `POST /api/table-trace`
- `GET /api/top-metrics/{fid}`
- `POST /api/top-metrics/{fid}/trace/{sheet}/{cell}`

### AI flows

- `POST /api/explain`
- `POST /api/business-summary`
- `POST /api/table-explain-batch`
- `POST /api/top-metrics/explain-all`
- `POST /api/optimize`

## Development Notes

### Mock LLM mode

If `EFT_LLM_MODE=mock` is enabled, the UI and API can still exercise explanation flows without requiring live credentials. This is useful for front-end and API development when the real proxy is unavailable.

### Upload persistence

Uploaded workbooks are stored under:

```text
app/backend/uploads/
```

The registry is maintained in:

```text
app/backend/uploads/registry.json
```

### Build verification

Frontend build:

```bash
cd app/frontend
npm run build
```

Backend import check:

```bash
.venv/bin/python -m py_compile app/config_loader.py app/llm_client.py app/backend/main.py
```

## Roadmap

- finish full PRD parity for workbook parsing and UI behavior
- complete production-level polish across the trace and sheet views
- validate live LLM proxy integration with real credentials
- implement audio transcription support
- expand automated testing for backend helpers and frontend flows

## Contributing

This repository is currently being actively built. If you are iterating locally:

- keep ports configurable
- avoid destructive git operations
- prefer smoke testing after backend changes
- validate the frontend build before pushing

## License

No license has been added yet.
