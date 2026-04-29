# Deploying CalcSense with Vercel

## Important architecture note

The current CalcSense backend stores uploaded workbooks and JSON caches on the local filesystem under:

- `app/backend/uploads/`

That makes the frontend a good fit for Vercel, but the backend is **not** a good fit for a plain Vercel serverless deployment without further changes.

Why:

- local disk on serverless platforms is not durable
- workbook state is kept in memory
- uploads need persistent storage across restarts

Official Vercel guidance recommends persistent object or database storage for writes instead of relying on function-local files:

- [Vercel storage overview](https://vercel.com/docs/storage)
- [How can I use files in Vercel Functions?](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions)

## Recommended deployment split

### Option A: Recommended now

- Deploy the **Next.js frontend** to Vercel
- Deploy the **FastAPI backend** to a long-running environment:
  - Railway
  - Render
  - Fly.io
  - ECS / Kubernetes
  - VM / container host
- Recommended Vercel setup:
  - do **not** expose the backend URL directly in the browser unless you want to
  - set a server-side rewrite target in Vercel:

```env
BACKEND_PROXY_URL=https://your-backend.example.com
```

- The frontend will then call the Vercel app itself at `/backend/...`, and Next.js will proxy those requests to your backend.
- If you prefer direct browser-to-backend calls instead, you can still set:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

### Option B: Full Vercel later

If you want the backend on Vercel too, first refactor:

- workbook uploads to `Vercel Blob` or another object store
- registry/caches to durable storage
- in-memory state to database or external cache

## Frontend deployment on Vercel

Set the project root to:

```text
app/frontend
```

Environment variables for Vercel:

```env
BACKEND_PROXY_URL=https://your-backend.example.com
```

Optional alternative:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

### How the proxy mode works

- Leave `NEXT_PUBLIC_API_URL` unset in Vercel
- Set `BACKEND_PROXY_URL`
- The frontend uses `/backend` as its API base
- `next.config.ts` rewrites `/backend/:path*` to your backend host

This keeps the browser talking to the Vercel frontend origin while the frontend forwards requests to FastAPI.

### Exact Vercel setup

Recommended:

- Root Directory: `app/frontend`
- Framework Preset: `Next.js`
- Production Environment Variable:
  - `BACKEND_PROXY_URL=https://your-backend.example.com`

Optional direct-call mode:

- `NEXT_PUBLIC_API_URL=https://your-backend.example.com`

Do not set both unless you intentionally want `NEXT_PUBLIC_API_URL` to override proxy mode.

## Backend deployment checklist

Minimum backend environment variables:

```env
EFT_RUNTIME=local
EFT_API_ENV=test
EFT_LLM_MODE=live
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
AWS_REGION=us-east-1
APP_NAME=calcsense
WHISPER_MODEL_SIZE=small
CALCSENSE_CORS_ORIGINS=https://your-frontend.vercel.app
CALCSENSE_TRUSTED_HOSTS=your-backend.example.com
CALCSENSE_LOG_LEVEL=INFO
CALCSENSE_USE_LIBREOFFICE_RECALC=false
```

Optional backend variables:

```env
OPENAI_BASE_URL=https://your-openai-compatible-endpoint.example.com/v1
LIBREOFFICE_BIN=/path/to/soffice
```

Operational checklist:

- set `CALCSENSE_CORS_ORIGINS` to your Vercel frontend URL
- set `CALCSENSE_TRUSTED_HOSTS` to your backend hostname
- run behind HTTPS
- enable centralized logs
- keep uploads off publicly accessible disk paths
