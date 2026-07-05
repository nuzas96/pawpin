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


// ---------------------------------------------------------------------------
// Metadata stripping (privacy hardening — M6)
//
// Phone cameras embed GPS/EXIF metadata in photos. Because PawPin's public
// map deliberately fuzzes coordinates, embedded EXIF GPS in an uploaded photo
// would be a bypass of that privacy layer. `stripImageMetadata` removes it
// with ZERO native dependencies (no `sharp`), so it never risks the build or
// local demo:
//   - JPEG: drops APP1 (EXIF/XMP) and COM (comment) segments; keeps APP0
//     (JFIF), quantisation/Huffman tables, frame headers, and scan data, so
//     image quality and colour are preserved.
//   - PNG: drops textual/metadata chunks (tEXt, zTXt, iTXt, tIME, eXIf);
//     keeps all rendering-critical chunks.
//   - WEBP: passed through unchanged — a full RIFF/EXIF/XMP-chunk rewrite is
//     the one documented remaining gap (see docs/security-report.md).
//
// On any parse surprise the ORIGINAL bytes are returned (fail-open on
// functionality: a valid image still uploads; this is no worse than the
// pre-M6 behaviour). Callers that care can compare byte lengths.
// ---------------------------------------------------------------------------

function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  // Must start with SOI (FF D8).
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;

  const out: number[] = [0xff, 0xd8];
  let i = 2;

  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return bytes; // malformed — bail, keep original
    const marker = bytes[i + 1];

    // Start of Scan: copy the rest verbatim (entropy-coded data + EOI).
    if (marker === 0xda) {
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]);
      return Uint8Array.from(out);
    }

    // Standalone markers with no length payload (RSTn, SOI, EOI, TEM).
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      out.push(bytes[i], bytes[i + 1]);
      i += 2;
      continue;
    }

    // Length-carrying segment: 2 bytes big-endian, including the length bytes.
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return bytes; // malformed

    const isExifOrXmp = marker === 0xe1; // APP1
    const isComment = marker === 0xfe; // COM
    if (!isExifOrXmp && !isComment) {
      for (let j = i; j < i + 2 + length; j++) out.push(bytes[j]);
    }
    i += 2 + length;
  }

  return Uint8Array.from(out);
}

const PNG_STRIP_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "tIME", "eXIf"]);

function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const SIG_LEN = 8;
  if (bytes.length < SIG_LEN + 12) return bytes;

  const out: number[] = [];
  for (let j = 0; j < SIG_LEN; j++) out.push(bytes[j]);

  let i = SIG_LEN;
  const decoder = new TextDecoder("latin1");
  while (i + 8 <= bytes.length) {
    const length = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 0 || i + 12 + length > bytes.length) return bytes; // malformed
    const type = decoder.decode(bytes.subarray(i + 4, i + 8));
    const chunkEnd = i + 12 + length; // 4 len + 4 type + data + 4 crc

    if (!PNG_STRIP_CHUNKS.has(type)) {
      for (let j = i; j < chunkEnd; j++) out.push(bytes[j]);
    }

    i = chunkEnd;
    if (type === "IEND") break;
  }

  return Uint8Array.from(out);
}

/**
 * Strip privacy-sensitive metadata from an image's bytes based on its
 * detected MIME. Returns new bytes (or the original on parse issues / for
 * WEBP). Pure function, no external dependencies.
 */
export function stripImageMetadata(bytes: Uint8Array, detectedMime: string): Uint8Array {
  try {
    if (detectedMime === "image/jpeg") return stripJpegMetadata(bytes);
    if (detectedMime === "image/png") return stripPngMetadata(bytes);
    return bytes; // image/webp (partial — documented) or anything else
  } catch {
    return bytes;
  }
}
