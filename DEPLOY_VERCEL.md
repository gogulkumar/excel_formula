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
- Point the frontend at the backend with:

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

Environment variable:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

## Backend deployment checklist

- set `CALCSENSE_CORS_ORIGINS` to your Vercel frontend URL
- set `CALCSENSE_TRUSTED_HOSTS` to your backend hostname
- run behind HTTPS
- enable centralized logs
- keep uploads off publicly accessible disk paths
