export const runtime = "nodejs";
import { listFiles } from "@/lib/server/storage";

export function GET() {
  const files = listFiles();
  return Response.json(files);
}
