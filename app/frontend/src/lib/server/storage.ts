/**
 * File storage for CalcSense API routes.
 *
 * Strategy:
 *   - Local / Vercel dev:  /tmp/calcsense/  (fast, no auth)
 *   - Vercel production:   /tmp/calcsense/  (ephemeral per instance — enough for single-user demos)
 *
 * For multi-user production you can swap the read/write helpers to use
 * Vercel Blob (BLOB_READ_WRITE_TOKEN env var) without changing any route code.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { loadWorkbook, workbookToBuffer } from "./excel";
import type { TableRegion } from "./excel";

// ─── Paths ────────────────────────────────────────────────────────────────────

const STORE_ROOT =
  process.env.CALCSENSE_STORE_ROOT ??
  path.join(process.env.TMPDIR ?? "/tmp", "calcsense");

const REGISTRY_PATH = path.join(STORE_ROOT, "registry.json");

function fileDir(fileId: string) {
  return path.join(STORE_ROOT, fileId);
}

function filePath(fileId: string) {
  return path.join(fileDir(fileId), "file.xlsx");
}

function explanationsPath(fileId: string) {
  return path.join(fileDir(fileId), "explanations.json");
}

function tablesPath(fileId: string, sheet: string) {
  return path.join(fileDir(fileId), `tables_${sanitizeSheet(sheet)}.json`);
}

function sanitizeSheet(sheet: string) {
  return sheet.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export interface RegistryEntry {
  file_id: string;
  filename: string;
  sheets: string[];
  uploaded_at: string;
}

function ensureStoreRoot() {
  fs.mkdirSync(STORE_ROOT, { recursive: true });
}

function readRegistry(): Record<string, RegistryEntry> {
  try {
    ensureStoreRoot();
    const text = fs.readFileSync(REGISTRY_PATH, "utf8");
    return JSON.parse(text) as Record<string, RegistryEntry>;
  } catch {
    return {};
  }
}

function writeRegistry(registry: Record<string, RegistryEntry>) {
  ensureStoreRoot();
  const tmp = REGISTRY_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(registry, null, 2));
  fs.renameSync(tmp, REGISTRY_PATH);
}

export function listFiles(): RegistryEntry[] {
  const registry = readRegistry();
  return Object.values(registry).sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
  );
}

export function getFile(fileId: string): RegistryEntry | null {
  return readRegistry()[fileId] ?? null;
}

export function deleteFile(fileId: string): boolean {
  const registry = readRegistry();
  if (!registry[fileId]) return false;
  delete registry[fileId];
  writeRegistry(registry);
  try {
    fs.rmSync(fileDir(fileId), { recursive: true, force: true });
  } catch { /* ignore */ }
  return true;
}

// ─── Workbook I/O ─────────────────────────────────────────────────────────────

export async function saveUploadedFile(
  fileBuffer: Buffer,
  filename: string,
): Promise<{ fileId: string; entry: RegistryEntry; wb: ReturnType<typeof loadWorkbook> }> {
  const wb = loadWorkbook(fileBuffer);
  const sheets = wb.SheetNames;
  const fileId = crypto.randomBytes(6).toString("hex"); // 12-char hex like Python uuid

  const dir = fileDir(fileId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath(fileId), fileBuffer);

  const entry: RegistryEntry = {
    file_id: fileId,
    filename: sanitizeFilename(filename),
    sheets,
    uploaded_at: new Date().toISOString(),
  };

  const registry = readRegistry();
  registry[fileId] = entry;
  writeRegistry(registry);

  return { fileId, entry, wb };
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name || "workbook.xlsx");
  return base.replace(/[^A-Za-z0-9._\- ]/g, "_").slice(0, 180) || "workbook.xlsx";
}

export function readWorkbookBuffer(fileId: string): Buffer | null {
  try {
    return fs.readFileSync(filePath(fileId));
  } catch {
    return null;
  }
}

export function readWorkbook(fileId: string): ReturnType<typeof loadWorkbook> | null {
  const buf = readWorkbookBuffer(fileId);
  if (!buf) return null;
  return loadWorkbook(buf);
}

export function saveWorkbook(fileId: string, wb: ReturnType<typeof loadWorkbook>): void {
  const buf = workbookToBuffer(wb);
  fs.writeFileSync(filePath(fileId), buf);
}

// ─── Explanation cache ────────────────────────────────────────────────────────

export function loadExplanations(fileId: string): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(explanationsPath(fileId), "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveExplanation(fileId: string, sheet: string, cell: string, kind: string, text: string): void {
  const key = `${kind}:${sheet}!${cell}`;
  const cache = loadExplanations(fileId);
  cache[key] = text;
  const tmp = explanationsPath(fileId) + ".tmp";
  fs.mkdirSync(path.dirname(explanationsPath(fileId)), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, explanationsPath(fileId));
}

export function getExplanation(fileId: string, sheet: string, cell: string, kind: string): string | null {
  const key = `${kind}:${sheet}!${cell}`;
  return loadExplanations(fileId)[key] ?? null;
}

// ─── Table cache ──────────────────────────────────────────────────────────────

export function loadCachedTables(fileId: string, sheet: string): TableRegion[] | null {
  try {
    return JSON.parse(fs.readFileSync(tablesPath(fileId, sheet), "utf8")) as TableRegion[];
  } catch {
    return null;
  }
}

export function saveCachedTables(fileId: string, sheet: string, tables: TableRegion[]): void {
  const p = tablesPath(fileId, sheet);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(tables, null, 2));
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

export function sseStream(
  handler: (enqueue: (data: object) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await handler(enqueue);
      } catch (err) {
        enqueue({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function notFound(message = "Not found"): Response {
  return Response.json({ error: message }, { status: 404 });
}
