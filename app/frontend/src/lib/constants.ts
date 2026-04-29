// All API calls now go to Next.js Route Handlers on the same origin.
// NEXT_PUBLIC_API_URL can still be set to override (e.g. to point at the old Python backend).
export const API = process.env.NEXT_PUBLIC_API_URL ?? "";
