export const runtime = "nodejs";

import { jsonError } from "@/lib/server/storage";

export async function POST() {
  return jsonError(
    "Chart insertion is not available in the one-project deployment yet. The chart spec was generated, but writing charts back into the workbook still needs a durable workbook backend.",
    501,
  );
}
