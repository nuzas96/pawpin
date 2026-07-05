import { describe, it, expect } from "vitest";
import {
  validateImageFile,
  detectImageType,
  MAX_IMAGE_BYTES,
} from "@/lib/validation/image";
import { signUpSchema, sightingSchema, commentSchema, linkSightingSchema, createCatFromSightingSchema } from "@/lib/validation/schemas";

describe("validateImageFile", () => {
  it("accepts a valid jpeg under the size limit", () => {
    expect(
      validateImageFile({ type: "image/jpeg", size: 1024, name: "cat.jpg" })
    ).toEqual({ ok: true });
  });

  it("rejects an unsupported mime type", () => {
    const result = validateImageFile({ type: "image/gif", size: 1024, name: "cat.gif" });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 8MB", () => {
    const result = validateImageFile({
      type: "image/png",
      size: MAX_IMAGE_BYTES + 1,
      name: "big.png",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a spoofed extension", () => {
    const result = validateImageFile({ type: "image/png", size: 10, name: "cat.exe" });
    expect(result.ok).toBe(false);
  });
});

describe("detectImageType (magic bytes)", () => {
  it("detects PNG signature", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageType(png)).toBe("image/png");
  });

  it("detects JPEG signature", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageType(jpeg)).toBe("image/jpeg");
  });

  it("returns null for unknown bytes", () => {
    const junk = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(detectImageType(junk)).toBeNull();
  });
});

describe("signUpSchema", () => {
  it("rejects short passwords", () => {
    const result = signUpSchema.safeParse({
      email: "a@b.com",
      password: "short",
      displayName: "Tester",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid input", () => {
    const result = signUpSchema.safeParse({
      email: "a@b.com",
      password: "longenough1",
      displayName: "Tester",
    });
    expect(result.success).toBe(true);
  });
});

describe("sightingSchema", () => {
  it("rejects out-of-range coordinates", () => {
    const result = sightingSchema.safeParse({
      lat: 200,
      lng: 0,
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid sighting with default traits", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a condition tag outside the allowed set", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      conditionTags: ["rabid"],
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple valid condition tags", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      conditionTags: ["hungry", "friendly", "tnr_needed"],
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional guest contact under the max length", () => {
    const result = sightingSchema.safeParse({
      lat: 1.35,
      lng: 103.8,
      guestContact: "+65 9123 4567",
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing latitude", () => {
    const result = sightingSchema.safeParse({
      lng: 103.8,
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });
});

describe("commentSchema", () => {
  it("requires a cat or case target", () => {
    const result = commentSchema.safeParse({ body: "hi" });
    expect(result.success).toBe(false);
  });
});


describe("linkSightingSchema", () => {
  it("requires both sightingId and catId as valid UUIDs", () => {
    const result = linkSightingSchema.safeParse({ sightingId: "not-a-uuid", catId: "also-not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload", () => {
    const result = linkSightingSchema.safeParse({
      sightingId: "11111111-1111-1111-1111-111111111111",
      catId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing catId", () => {
    const result = linkSightingSchema.safeParse({ sightingId: "11111111-1111-1111-1111-111111111111" });
    expect(result.success).toBe(false);
  });
});

describe("createCatFromSightingSchema", () => {
  it("requires a valid sightingId and traits", () => {
    const result = createCatFromSightingSchema.safeParse({ sightingId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload with default traits", () => {
    const result = createCatFromSightingSchema.safeParse({
      sightingId: "11111111-1111-1111-1111-111111111111",
      traits: { coatColor: "orange", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid coat colour in traits", () => {
    const result = createCatFromSightingSchema.safeParse({
      sightingId: "11111111-1111-1111-1111-111111111111",
      traits: { coatColor: "rainbow", furPattern: "tabby", sizeClass: "medium" },
    });
    expect(result.success).toBe(false);
  });
});
