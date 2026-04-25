#!/usr/bin/env bash
set -euo pipefail

cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &
cd /app/ui && PORT=8080 HOSTNAME=0.0.0.0 node server.js

