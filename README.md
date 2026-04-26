# FormulaLens

FormulaLens is an AI-assisted workbook intelligence platform designed to help teams understand, explain, and modernize complex Excel models faster. It converts hidden spreadsheet logic into a transparent, navigable application so analysts, finance leaders, and transformation teams can review business-critical formulas without manually reverse-engineering large workbooks.

## Executive Summary

Spreadsheet models often become operational systems of record, yet their logic is difficult to audit, explain, and transfer. FormulaLens addresses that gap by turning `.xlsx` workbooks into an interactive experience that exposes formula dependencies, highlights top-level metrics, detects table structures, and generates both technical and executive-ready explanations.

The result is a faster path to:

- Understand how key outputs are calculated
- Reduce time spent tracing formulas across sheets
- Improve auditability and knowledge transfer
- Support modernization and optimization efforts for spreadsheet-driven processes

## Business Value

FormulaLens is built for scenarios where spreadsheet complexity creates delivery, control, or continuity risk.

### Typical use cases

- **Executive review:** Summarize how major KPIs and outputs are derived
- **Finance and FP&A analysis:** Inspect formula chains and validate model logic
- **Audit and controls:** Trace dependencies and surface calculation paths
- **Handover and onboarding:** Shorten the learning curve for inherited workbooks
- **Transformation programs:** Document spreadsheet logic before redesign or automation

## Core Capabilities

### Workbook intelligence

- Upload and retain `.xlsx` workbooks
- Restore uploaded files after restart
- Load formulas and computed values for analysis
- Stream large sheet loads for better responsiveness

### Formula tracing

- Trace dependencies downstream from a selected cell
- Trace upstream references to see where values are used
- Identify cross-sheet links, ranges, and circular references
- Surface top-level metrics not referenced by other formulas

### Table and metric analysis

- Detect table-like regions within sheets
- Trace metrics inside a selected table region
- Review workbook structure through a browser-based interface

### AI-assisted explanation

- Generate technical explanations for analyst audiences
- Generate business summaries for executive audiences
- Produce formula blueprints and snapshots
- Stream long-running AI tasks with reconnection support
- Run in mock mode when live LLM access is unavailable

## Platform Overview

FormulaLens is delivered as a two-tier web application:

- **Backend:** FastAPI services for upload, parsing, tracing, table detection, metrics, and AI task orchestration
- **Frontend:** Next.js application for workbook upload, browsing, tracing, and analysis workflows

### Technology stack

**Backend**

- Python 3.12+
- FastAPI
- Uvicorn
- openpyxl
- httpx

**Frontend**

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- React Flow
- dagre
- react-markdown

**LLM integration**

- OpenAI-compatible proxy support
- Bedrock-compatible proxy support
- Environment-driven configuration
- Local mock mode for development and demos

## Current Maturity

The repository contains a working product foundation with end-to-end workbook lifecycle support, formula tracing, metric discovery, table analysis, and AI-assisted explanation flows.

Current priorities include:

- Additional production polish across the user experience
- Broader automated test coverage
- Full validation of live proxy-backed AI integrations
- Completion of remaining roadmap items such as audio transcription

## Repository Structure

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

```bash
cp app/.env.example app/.env
```

For local development without live LLM credentials, use:

```env
EFT_RUNTIME=local
EFT_API_ENV=test
EFT_LLM_MODE=mock
NEXT_PUBLIC_API_URL=http://localhost:8010
APP_NAME=formulalens
AWS_REGION=us-east-1
```

For proxy-backed AI access, configure either:

```env
LLM_PROXY_HOST=your-proxy-host.example.com
LLM_PROXY_SCHEME=https
EFT_PROXY_AUTH_TOKEN=Basic YOUR_TOKEN
```

or explicit proxy URLs:

```env
EFT_OPENAI_PROXY_URL=https://your-host.example.com/v1/proxy/azure-openai
EFT_BEDROCK_PROXY_URL=https://your-host.example.com/v1/proxy/bedrock
EFT_PROXY_AUTH_TOKEN=Basic YOUR_TOKEN
```

## Running Locally

Default local ports:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

If you need alternate ports:

```bash
make start BACKEND_PORT=8010 FRONTEND_PORT=3001 NEXT_PUBLIC_API_URL=http://localhost:8010
```

To stop the local servers:

```bash
make stop
```

## Validation

Run the smoke test:

```bash
make test
```

Optional frontend production build:

```bash
cd app/frontend && npm run build
```

Optional backend import check:

```bash
.venv/bin/python -m py_compile app/config_loader.py app/llm_client.py app/backend/main.py
```

## Key API Endpoints

### File lifecycle

- `POST /api/upload`
- `GET /api/files`
- `GET /api/files/{fid}`
- `DELETE /api/files/{fid}`

### Workbook data

- `GET /api/sheet/{fid}/{sheet}`
- `GET /api/sheet-stream/{fid}/{sheet}`
- `POST /api/reload/{fid}`
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
- `POST /api/reconstruct`
- `POST /api/snapshot`
- `GET /api/task/{task_id}`
- `GET /api/task/{task_id}/stream`
- `POST /api/task/{task_id}/cancel`
- `POST /api/table-explain-batch`
- `POST /api/top-metrics/explain-all`
- `POST /api/optimize`

## Operational Notes

- Uploaded workbooks are stored in `app/backend/uploads/`
- Upload metadata is tracked in `app/backend/uploads/registry.json`
- Mock LLM mode enables UI and API development without live credentials

## Roadmap

- Complete remaining production polish across major views
- Expand automated testing across backend and frontend flows
- Validate live LLM proxy integrations in production-like conditions
- Implement audio transcription support

## Contributing

This project is under active development. When contributing locally:

- Keep ports configurable
- Avoid destructive git operations
- Prefer smoke testing after backend changes
- Validate the frontend build before pushing

## License

No license has been added yet.
