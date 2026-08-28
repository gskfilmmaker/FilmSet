import "server-only";
import { getServerSupabase } from "@filmset/auth/server";

/**
 * Cast headshots and Location/set photos, in one private Storage bucket
 * (see packages/db/migrations/0010_photo_storage_bucket.sql for the RLS
 * that scopes every read/write to production membership). Not public —
 * every display path goes through resolvePhotoUrls' signed URLs, never a
 * direct bucket URL.
 */
const BUCKET = "production-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type PhotoEntityType = "cast" | "location";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  const fromType = file.type.split("/").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromType || "jpg";
}

/** Uploads a photo and returns the Storage object path to persist on the owning row. */
export async function uploadEntityPhoto(productionId: string, entityType: PhotoEntityType, entityId: string, file: File): Promise<string> {
  const supabase = await getServerSupabase();
  const path = `${productionId}/${entityType}/${entityId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

/** Best-effort delete — never blocks the caller's own write on cleanup failing. */
export async function deleteEntityPhoto(path: string): Promise<void> {
  try {
    const supabase = await getServerSupabase();
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Orphaned object — harmless, not worth failing the caller's action over.
  }
}

/** Batch-resolves Storage paths to time-limited signed URLs for display. */
export async function resolvePhotoUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
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
