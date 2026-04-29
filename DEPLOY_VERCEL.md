# Deploying CalcSense on Vercel

## Recommended mode: one Vercel project

CalcSense can now run as a single Vercel project from:

```text
app/frontend
```

In this mode:

- the browser talks to the same Vercel origin
- frontend requests go to `/api/*`
- Next.js route handlers inside `app/frontend/src/app/api/` handle uploads, tracing, chat, and workbook actions

## Vercel project settings

- Root Directory: `app/frontend`
- Framework Preset: `Next.js`

## Vercel environment variables

Minimum:

```env
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Optional:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
CALCSENSE_MODEL=gpt-4.1
CALCSENSE_STORE_ROOT=/tmp/calcsense
```

Important:

- do **not** set `NEXT_PUBLIC_API_URL` for one-project mode
- do **not** set `BACKEND_PROXY_URL` for one-project mode

If either of those is set to `localhost` or an old backend URL, the deployed app will bypass same-origin `/api/*` routing and break uploads or API calls.

## Local development for one-project mode

Use:

- `app/frontend/.env.local`

It should contain:

```env
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

And it should **not** set:

```env
NEXT_PUBLIC_API_URL=
BACKEND_PROXY_URL=
```

## Legacy split deployment mode

Only use this if you intentionally want a separate backend host.

Then you may set one of:

```env
BACKEND_PROXY_URL=https://your-backend.example.com
```

or

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

But that is no longer the default deployment model for this repo.
