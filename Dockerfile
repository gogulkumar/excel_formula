FROM node:20-alpine AS ui-builder
WORKDIR /build
COPY app/frontend/package.json app/frontend/package-lock.json* ./
RUN npm ci --ignore-scripts || npm install
COPY app/frontend/ .
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

FROM python:3.12.3-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates nodejs npm \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app/backend /app/backend
COPY app/config_loader.py /app/config_loader.py
COPY app/llm_client.py /app/llm_client.py
COPY app/prompts /app/prompts
COPY scripts/start.sh /app/start.sh

COPY --from=ui-builder /build/.next/standalone /app/ui
COPY --from=ui-builder /build/.next/static /app/ui/.next/static
COPY --from=ui-builder /build/public /app/ui/public

RUN chmod +x /app/start.sh
RUN groupadd appuser && useradd -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/ping || exit 1

CMD ["/app/start.sh"]
