import "server-only";
import { getServerSupabase } from "@filmset/auth/server";

/**
 * Cast/crew headshots, Location/set photos, and production logos, in one
 * private Storage bucket (see packages/db/migrations/0010_photo_storage_bucket.sql
 * for the RLS that scopes every read/write to production membership — it
 * trusts only the first path segment, the production id, so adding new
 * PhotoEntityType values here needs no new migration). Not public — every
 * display path goes through resolvePhotoUrls' signed URLs, never a direct
 * bucket URL.
 */
const BUCKET = "production-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** No SVG — it can carry active script content and isn't a headshot/set-photo format anyone needs here. */
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type PhotoEntityType = "cast" | "location" | "crew" | "production";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  const fromType = file.type.split("/").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromType || "jpg";
}

/**
 * Uploads a photo and returns the Storage object path to persist on the
 * owning row. Client-side checks (PhotoAvatar) are a UX nicety only — a
 * request can bypass the browser entirely, so type and size are enforced
 * again here, server-side, before anything reaches Storage.
 */
export async function uploadEntityPhoto(productionId: string, entityType: PhotoEntityType, entityId: string, file: File): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) throw new Error("Photo must be a JPEG, PNG, WebP, or GIF image.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be 5MB or smaller.");

  const supabase = await getServerSupabase();
  const path = `${productionId}/${entityType}/${entityId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
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
