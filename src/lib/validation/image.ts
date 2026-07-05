/**
 * Image validation shared by client and server. The server must always
 * re-validate — client checks are only for fast UX feedback.
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ALLOWED_IMAGE_EXT = ["jpg", "jpeg", "png", "webp"] as const;

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Validate a File/Blob-like object by MIME type and size. */
export function validateImageFile(file: {
  type: string;
  size: number;
  name?: string;
}): ImageValidationResult {
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: JPG, JPEG, PNG, WEBP.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image exceeds the 8 MB size limit." };
  }
  if (file.name) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !(ALLOWED_IMAGE_EXT as readonly string[]).includes(ext)) {
      return { ok: false, error: "Unsupported file extension." };
    }
  }
  return { ok: true };
}

/**
 * Verify the file's magic bytes match its declared type. Defends against
 * a renamed/spoofed MIME. Intended for server-side use with the file buffer.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 &&
    bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
