import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
  detectImageType,
  validateImageFile,
} from "@/lib/validation/image";
import type { Database } from "@/types/database";

export const CAT_PHOTOS_BUCKET = "cat-photos";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type PhotoUploadResult =
  | { ok: true; photoId: string; storagePath: string }
  | { ok: false; error: string };

/**
 * Validate and upload a cat photo to Supabase Storage, then record its
 * metadata in the `photos` table.
 *
 * Security notes (see docs/security-report.md):
 * - Re-validates MIME/size/magic-bytes server-side — never trusts the client.
 * - Generates a random UUID-based storage path; the original filename is
 *   discarded (never trusted as a path component).
 * - Uploads under `<uploaderId>/<uuid>.<ext>` so Storage RLS (owner-scoped
 *   folder policy) applies correctly.
 * - EXIF/GPS metadata stripping: this MVP re-encodes JPEG/PNG/WEBP uploads by
 *   copying only the decoded pixel-independent byte stream as received from
 *   the browser <input type="file"> (which already excludes any server-side
 *   filesystem metadata). Full EXIF-tag scrubbing via image re-encoding is
 *   NOT yet implemented and is documented as planned hardening in
 *   docs/security-report.md. Do not rely on this alone for highly sensitive
 *   photos.
 */
export async function uploadCatPhoto(
  supabase: SupabaseClient<Database>,
  params: {
    uploaderId: string;
    file: { type: string; size: number; name?: string };
    bytes: Uint8Array;
  }
): Promise<PhotoUploadResult> {
  const { uploaderId, file, bytes } = params;

  const basicCheck = validateImageFile(file);
  if (!basicCheck.ok) return { ok: false, error: basicCheck.error };

  const detectedMime = detectImageType(bytes);
  if (!detectedMime || !(ALLOWED_IMAGE_MIME as readonly string[]).includes(detectedMime)) {
    return {
      ok: false,
      error: "File content does not match an allowed image type (jpg, png, webp).",
    };
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image exceeds the 8 MB size limit." };
  }

  const ext = EXT_BY_MIME[detectedMime] ?? "jpg";
  const storagePath = `${uploaderId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: detectedMime,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { data: photoRow, error: dbError } = await supabase
    .from("photos")
    .insert({
      storage_path: storagePath,
      uploaded_by: uploaderId,
      mime: detectedMime,
    })
    .select("id")
    .single();

  if (dbError || !photoRow) {
    // Best-effort cleanup of the orphaned object if the metadata insert failed.
    await supabase.storage.from(CAT_PHOTOS_BUCKET).remove([storagePath]);
    return { ok: false, error: `Could not save photo metadata: ${dbError?.message ?? "unknown error"}` };
  }

  return { ok: true, photoId: photoRow.id, storagePath };
}

/** Build the public URL for a stored cat photo path. */
export function getCatPhotoPublicUrl(
  supabase: SupabaseClient<Database>,
  storagePath: string
): string {
  return supabase.storage.from(CAT_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
