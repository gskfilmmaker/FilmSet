import "server-only";
import { getServerSupabase } from "@filmset/auth/server";

/**
 * Invoice/receipt attachments (Money) and uploaded documents (Documents),
 * in one private Storage bucket (see packages/db/migrations/0015_production_files_bucket.sql
 * for the RLS scoping every read/write to production membership). Not
 * public — every display path resolves a signed URL server-side, never a
 * direct bucket URL. Distinct from photo-storage.ts's production-photos
 * bucket since these are general files (PDF, DOCX, XLSX...), not images.
 */
const BUCKET = "production-files";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export type FileEntityType = "expense" | "document";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromName || "bin";
}

/**
 * Uploads a file and returns the Storage object path to persist on the
 * owning row. Client forms should also validate, but that's UX only — type
 * and size are enforced again here, server-side, before anything reaches
 * Storage.
 */
export async function uploadEntityFile(productionId: string, entityType: FileEntityType, entityId: string, file: File): Promise<string> {
  if (!ALLOWED_FILE_TYPES.has(file.type)) throw new Error("Unsupported file type. Use PDF, Word, Excel, plain text, or an image.");
  if (file.size > MAX_FILE_BYTES) throw new Error("File must be 15MB or smaller.");

  const supabase = await getServerSupabase();
  const path = `${productionId}/${entityType}/${entityId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`File upload failed: ${error.message}`);
  return path;
}

/** Best-effort delete — never blocks the caller's own write on cleanup failing. */
export async function deleteEntityFile(path: string): Promise<void> {
  try {
    const supabase = await getServerSupabase();
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Orphaned object — harmless, not worth failing the caller's action over.
  }
}

/** Batch-resolves Storage paths to time-limited signed URLs for display/download. */
export async function resolveFileUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniquePaths = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (uniquePaths.length === 0) return {};

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return {};

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}
