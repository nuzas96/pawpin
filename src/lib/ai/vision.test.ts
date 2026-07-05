import { describe, it, expect, afterEach } from "vitest";
import { isAiVisionEnabled, suggestTraitsFromImage } from "@/lib/ai/vision";
import { aiTraitSuggestionSchema } from "@/lib/validation/schemas";

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
});

describe("AI Vision — graceful no-key fallback", () => {
  it("isAiVisionEnabled is false when no GEMINI_API_KEY is set", () => {
    delete process.env.GEMINI_API_KEY;
    expect(isAiVisionEnabled()).toBe(false);
  });

  it("isAiVisionEnabled is true when GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect(isAiVisionEnabled()).toBe(true);
  });

  it("suggestTraitsFromImage returns { status: 'disabled' } with no key — never throws, no network", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await suggestTraitsFromImage("aGVsbG8=", "image/jpeg");
    expect(result.status).toBe("disabled");
  });
});

describe("AI Vision — response validation (malformed handling)", () => {
  it("accepts a well-formed suggestion using app enum values", () => {
    const parsed = aiTraitSuggestionSchema.safeParse({
      coatColour: "orange",
      furPattern: "tabby",
      approximateSize: "medium",
      ageGroup: "adult",
      visibleInjuries: ["limping hind leg"],
      possiblePregnancy: false,
      distinguishingMarks: ["white chest patch"],
      confidence: "medium",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an out-of-enum coat colour (would degrade to no suggestion)", () => {
    const parsed = aiTraitSuggestionSchema.safeParse({
      coatColour: "rainbow",
      furPattern: "tabby",
      approximateSize: "medium",
      ageGroup: "adult",
      visibleInjuries: [],
      possiblePregnancy: false,
      distinguishingMarks: [],
      confidence: "high",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid confidence value", () => {
    const parsed = aiTraitSuggestionSchema.safeParse({
      coatColour: "black",
      furPattern: "solid",
      approximateSize: "small",
      ageGroup: "kitten",
      visibleInjuries: [],
      possiblePregnancy: false,
      distinguishingMarks: [],
      confidence: "certain",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a completely malformed (non-object) response", () => {
    expect(aiTraitSuggestionSchema.safeParse("not json at all").success).toBe(false);
    expect(aiTraitSuggestionSchema.safeParse(null).success).toBe(false);
    expect(aiTraitSuggestionSchema.safeParse([]).success).toBe(false);
  });

  it("defaults optional arrays/flags so a minimal valid object still parses", () => {
    const parsed = aiTraitSuggestionSchema.safeParse({
      coatColour: "grey",
      furPattern: "solid",
      approximateSize: "large",
      ageGroup: "senior",
      confidence: "low",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.visibleInjuries).toEqual([]);
      expect(parsed.data.possiblePregnancy).toBe(false);
      expect(parsed.data.distinguishingMarks).toEqual([]);
    }
  });
});
