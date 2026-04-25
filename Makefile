PYTHON ?= python3
VENV := .venv
PIP := $(VENV)/bin/pip
PY := $(VENV)/bin/python
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 3000
NEXT_PUBLIC_API_URL ?= http://localhost:$(BACKEND_PORT)

.PHONY: setup start stop clean test template

setup:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	cd app/frontend && npm install

start:
	$(MAKE) stop
	cd app/backend && ../../.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT) > /tmp/excel-formula-backend.log 2>&1 &
	cd app/frontend && PORT=$(FRONTEND_PORT) NEXT_PUBLIC_API_URL=$(NEXT_PUBLIC_API_URL) npm run dev > /tmp/excel-formula-frontend.log 2>&1 &
	@sleep 5
	@echo "Backend: http://localhost:$(BACKEND_PORT)"
	@echo "Frontend: http://localhost:$(FRONTEND_PORT)"

stop:
	-pkill -f "uvicorn main:app"
	-pkill -f "next dev"
	-pkill -f "node server.js"

clean:
	rm -rf $(VENV) app/frontend/.next app/frontend/node_modules
	find . -name "__pycache__" -type d -prune -exec rm -rf {} \;

test:
	.venv/bin/python scripts/smoke_test.py --spawn-server --include-llm

template:
	@echo "helm template preview not configured yet"
