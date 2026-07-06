import { describe, it, expect } from "vitest";
import { stripImageMetadata, detectImageType } from "@/lib/validation/image";

// Helpers to build minimal synthetic images with metadata segments.

function u8(...vals: number[]): Uint8Array {
  return Uint8Array.from(vals);
}

/** Build a JPEG: SOI, APP1(EXIF), APP0(JFIF), DQT, SOS + scan + EOI. */
function buildJpegWithExif(): { bytes: Uint8Array; exifMarker: number[] } {
  const exifPayload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x11, 0x22]; // "Exif\0\0" + GPS-ish bytes
  const app1Len = exifPayload.length + 2; // length includes the 2 length bytes
  const app1 = [0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...exifPayload];

  const jfifPayload = [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01]; // "JFIF"
  const app0Len = jfifPayload.length + 2;
  const app0 = [0xff, 0xe0, (app0Len >> 8) & 0xff, app0Len & 0xff, ...jfifPayload];

  const dqtPayload = [0x00, 0x01, 0x02, 0x03];
  const dqtLen = dqtPayload.length + 2;
  const dqt = [0xff, 0xdb, (dqtLen >> 8) & 0xff, dqtLen & 0xff, ...dqtPayload];

  const sos = [0xff, 0xda, 0x00, 0x02]; // minimal SOS header
  const scanAndEoi = [0x12, 0x34, 0x56, 0xff, 0xd9]; // fake scan bytes + EOI

  const bytes = u8(0xff, 0xd8, ...app1, ...app0, ...dqt, ...sos, ...scanAndEoi);
  return { bytes, exifMarker: exifPayload };
}

/** Build a PNG: signature, IHDR, tEXt (metadata), IDAT, IEND. */
function buildPngWithText(): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  function chunk(type: string, data: number[]): number[] {
    const len = data.length;
    const typeBytes = [...type].map((c) => c.charCodeAt(0));
    return [
      (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff,
      ...typeBytes,
      ...data,
      0, 0, 0, 0, // fake CRC
    ];
  }

  const ihdr = chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const text = chunk("tEXt", [0x47, 0x50, 0x53]); // "GPS" text metadata
  const idat = chunk("IDAT", [0x99, 0x88, 0x77]);
  const iend = chunk("IEND", []);

  return u8(...sig, ...ihdr, ...text, ...idat, ...iend);
}

describe("stripImageMetadata — JPEG", () => {
  it("removes the APP1/EXIF segment while keeping the image valid", () => {
    const { bytes } = buildJpegWithExif();
    const stripped = stripImageMetadata(bytes, "image/jpeg");
    expect(stripped).not.toBeNull();
    if (!stripped) return; // for TS

    // Still a JPEG.
    expect(detectImageType(stripped)).toBe("image/jpeg");
    // Smaller than the original (EXIF removed).
    expect(stripped.byteLength).toBeLessThan(bytes.byteLength);
    // No APP1 marker (FF E1) remains.
    let hasApp1 = false;
    for (let i = 0; i < stripped.length - 1; i++) {
      if (stripped[i] === 0xff && stripped[i + 1] === 0xe1) hasApp1 = true;
    }
    expect(hasApp1).toBe(false);
  });

  it("preserves the scan data (bytes after SOS) intact", () => {
    const { bytes } = buildJpegWithExif();
    const stripped = stripImageMetadata(bytes, "image/jpeg");
    expect(stripped).not.toBeNull();
    if (!stripped) return; // for TS
    // Ends with EOI.
    expect(stripped[stripped.length - 2]).toBe(0xff);
    expect(stripped[stripped.length - 1]).toBe(0xd9);
  });
});

describe("stripImageMetadata — PNG", () => {
  it("removes tEXt metadata chunks while keeping IHDR/IDAT/IEND", () => {
    const png = buildPngWithText();
    const stripped = stripImageMetadata(png, "image/png");
    expect(stripped).not.toBeNull();
    if (!stripped) return; // for TS

    expect(detectImageType(stripped)).toBe("image/png");
    expect(stripped.byteLength).toBeLessThan(png.byteLength);

    // The "tEXt" type bytes (0x74,0x45,0x58,0x74) must be gone.
    let hasText = false;
    for (let i = 0; i < stripped.length - 3; i++) {
      if (stripped[i] === 0x74 && stripped[i + 1] === 0x45 && stripped[i + 2] === 0x58 && stripped[i + 3] === 0x74) {
        hasText = true;
      }
    }
    expect(hasText).toBe(false);
  });
});

describe("stripImageMetadata — fail-closed", () => {
  it("returns null for WEBP or unsupported formats to prevent metadata bypass", () => {
    const webp = u8(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3);
    const out = stripImageMetadata(webp, "image/webp");
    expect(out).toBeNull();
  });

  it("returns null on malformed JPEG", () => {
    const junk = u8(0xff, 0xd8, 0x00, 0x00, 0x00);
    const out = stripImageMetadata(junk, "image/jpeg");
    expect(out).toBeNull();
  });

  it("returns null on malformed PNG", () => {
    const junk = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
    const out = stripImageMetadata(junk, "image/png");
    expect(out).toBeNull();
  });
});
