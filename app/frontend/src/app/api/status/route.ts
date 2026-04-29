export const runtime = "nodejs";

export function GET() {
  return Response.json({
    ready: true,
    stage: "ready",
    detail: "CalcSense API ready",
    files_loaded: 0,
    files_total: 0,
  });
}
