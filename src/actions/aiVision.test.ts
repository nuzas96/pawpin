import { describe, it, expect, vi, beforeEach } from "vitest";
import { suggestTraitsFromPhoto } from "./aiVision";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user" } } }),
    },
  }),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ ok: true }),
  RATE_LIMITS: { ai: 5 },
  RATE_LIMIT_MESSAGE: "Rate limited",
}));

vi.mock("@/lib/ai/vision", () => ({
  isAiVisionEnabled: vi.fn().mockReturnValue(true),
  suggestTraitsFromImage: vi.fn().mockResolvedValue({ status: "ok", suggestion: {} }),
}));

// We will mock stripImageMetadata to prove it is called and its result is used
vi.mock("@/lib/validation/image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/validation/image")>();
  return {
    ...actual,
    stripImageMetadata: vi.fn().mockImplementation((bytes, mime) => {
      if (mime === "image/jpeg") {
        return new Uint8Array([0xff, 0xd8, 0x99]); // Mock cleaned bytes
      }
      return null;
    }),
    detectImageType: vi.fn().mockReturnValue("image/jpeg"),
  };
});

import { stripImageMetadata } from "@/lib/validation/image";
import { suggestTraitsFromImage } from "@/lib/ai/vision";

describe("aiVision Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strips metadata from the image before sending to Gemini", async () => {
    const originalBase64 = Buffer.from(new Uint8Array([0xff, 0xd8, 0x01, 0x02])).toString("base64");
    
    const result = await suggestTraitsFromPhoto({
      base64: originalBase64,
      mime: "image/jpeg",
    });

    expect(result.ok).toBe(true);

    // Verify stripImageMetadata was called
    expect(stripImageMetadata).toHaveBeenCalled();

    // Verify suggestTraitsFromImage received the CLEANED base64, not the original
    const cleanedBase64 = Buffer.from(new Uint8Array([0xff, 0xd8, 0x99])).toString("base64");
    expect(suggestTraitsFromImage).toHaveBeenCalledWith(cleanedBase64, "image/jpeg");
    expect(suggestTraitsFromImage).not.toHaveBeenCalledWith(originalBase64, "image/jpeg");
  });
});
