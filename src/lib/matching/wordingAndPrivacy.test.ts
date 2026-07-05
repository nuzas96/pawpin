import { describe, it, expect } from "vitest";
import { scoreCandidate, findPossibleMatches } from "@/lib/matching/engine";
import type { MatchCandidate, MatchQuery, PublicMatchCandidate } from "@/lib/matching/types";

const FORBIDDEN_PHRASES = [
  "same cat detected",
  "ai identified",
  "identified the cat",
  "confirmed match",
  "definitely the same",
];

function baseQuery(): MatchQuery {
  return {
    lat: 1.3521,
    lng: 103.8198,
    occurredAt: new Date().toISOString(),
    coatColor: "orange",
    furPattern: "tabby",
    sizeClass: "medium",
    ageGroup: "adult",
    earTipped: false,
    distinguishingMarks: ["white chest patch"],
    conditionTags: ["friendly"],
  };
}

function baseCandidate(): MatchCandidate {
  return {
    catId: "cat-1",
    coatColor: "orange",
    furPattern: "tabby",
    sizeClass: "medium",
    ageGroup: "adult",
    earTipped: false,
    distinguishingMarks: ["white chest patch"],
    lastSighting: {
      lat: 1.3521,
      lng: 103.8198,
      occurredAt: new Date().toISOString(),
      conditionTags: ["friendly"],
      urgency: "medium",
    },
  };
}

describe("wording contract", () => {
  it("never uses forbidden certainty language in disclaimers or reasons", () => {
    const results = findPossibleMatches(baseQuery(), [baseCandidate()]);
    const allText = results
      .flatMap((r) => [r.disclaimer, ...r.reasons.map((reason) => `${reason.signal} ${reason.detail}`)])
      .join(" ")
      .toLowerCase();

    for (const phrase of FORBIDDEN_PHRASES) {
      expect(allText).not.toContain(phrase);
    }
  });

  it("always uses the exact required disclaimer string", () => {
    const result = scoreCandidate(baseQuery(), baseCandidate());
    expect(result.disclaimer).toBe("Possible match — human confirmation required");
  });
});

describe("public-safe match data", () => {
  it("PublicMatchCandidate type never has lat/lng fields", () => {
    const sample: PublicMatchCandidate = {
      candidateCatId: "cat-1",
      similarityScore: 90,
      confidence: "high",
      reasons: [{ signal: "Coat colour", contribution: 20, detail: "match" }],
      disclaimer: "Possible match — human confirmation required",
      photoUrl: null,
      status: "reported",
      coatColor: "orange",
      furPattern: "tabby",
      lastSeenAt: new Date().toISOString(),
      areaLabel: "Area 1.35, 103.82",
    };
    const keys = Object.keys(sample);
    expect(keys).not.toContain("lat");
    expect(keys).not.toContain("lng");
    expect(keys).not.toContain("fuzzed_lat");
    expect(keys).not.toContain("fuzzed_lng");
    expect(keys).toContain("areaLabel");
  });
});
