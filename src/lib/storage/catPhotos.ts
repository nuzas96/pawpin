import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
  detectImageType,
  stripImageMetadata,
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
 * - Rejects a spoofed MIME whose actual bytes are not an allowed image type.
 * - Strips embedded metadata (EXIF/GPS/XMP for JPEG, textual chunks for PNG)
 *   via `stripImageMetadata` before upload, so a phone photo's embedded GPS
 *   cannot bypass the map's coordinate-fuzzing privacy layer. WEBP metadata
 *   stripping is partial (documented gap).
 * - Generates a random UUID-based storage path; the original filename is
 *   discarded (never trusted as a path component).
 * - Uploads under `<uploaderId>/<uuid>.<ext>` so Storage RLS (owner-scoped
 *   folder policy) applies correctly.
 * - Cleans up the orphaned Storage object if the metadata insert fails.
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
      error: "This file doesn't look like a valid JPG, PNG, or WEBP image. Please choose a different photo.",
    };
  }
  // Defence-in-depth: reject a declared MIME that disagrees with the actual
  // bytes (e.g. a .png renamed to .jpg, or a disguised non-image).
  if (file.type && file.type !== detectedMime) {
    return {
      ok: false,
      error: "The file's type doesn't match its contents. Please choose a genuine image file.",
    };
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image exceeds the 8 MB size limit. Please choose a smaller photo." };
  }

  // Strip embedded metadata (EXIF/GPS/XMP) before the bytes ever leave the server.
  const cleanBytes = stripImageMetadata(bytes, detectedMime);

  const ext = EXT_BY_MIME[detectedMime] ?? "jpg";
  const storagePath = `${uploaderId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .upload(storagePath, cleanBytes, {
      contentType: detectedMime,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: "Could not upload the photo. Please try again in a moment." };
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
    return { ok: false, error: "Could not save the photo. Please try again." };
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
