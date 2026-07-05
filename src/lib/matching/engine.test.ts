import { describe, it, expect } from "vitest";
import { scoreCandidate, findPossibleMatches } from "@/lib/matching/engine";
import { MATCH_THRESHOLD } from "@/lib/matching/weights";
import type { MatchCandidate, MatchQuery } from "@/lib/matching/types";

const NOW = new Date("2026-01-15T12:00:00Z");

function baseQuery(overrides: Partial<MatchQuery> = {}): MatchQuery {
  return {
    lat: 1.3521,
    lng: 103.8198,
    occurredAt: NOW.toISOString(),
    coatColor: "orange",
    furPattern: "tabby",
    sizeClass: "medium",
    ageGroup: "adult",
    earTipped: false,
    distinguishingMarks: ["white chest patch"],
    conditionTags: ["friendly"],
    ...overrides,
  };
}

function baseCandidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
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
      occurredAt: NOW.toISOString(),
      conditionTags: ["friendly"],
      urgency: "medium",
    },
    ...overrides,
  };
}

describe("scoreCandidate — identical traits", () => {
  it("produces a very high score for an identical cat at the same place and time", () => {
    const result = scoreCandidate(baseQuery(), baseCandidate());
    expect(result.similarityScore).toBeGreaterThanOrEqual(95);
    expect(result.confidence).toBe("high");
    expect(result.disclaimer).toBe("Possible match — human confirmation required");
  });
});

describe("scoreCandidate — different traits", () => {
  it("produces a low score for a cat with opposite traits far away and long ago", () => {
    const query = baseQuery();
    const candidate = baseCandidate({
      coatColor: "black",
      furPattern: "solid",
      sizeClass: "large",
      ageGroup: "senior",
      earTipped: true,
      distinguishingMarks: ["scar on tail"],
      lastSighting: {
        lat: 40.7128, // New York — far from Singapore
        lng: -74.006,
        occurredAt: new Date("2020-01-01T00:00:00Z").toISOString(),
        conditionTags: ["sick"],
        urgency: "critical",
      },
    });
    const result = scoreCandidate(query, candidate);
    expect(result.similarityScore).toBeLessThan(MATCH_THRESHOLD);
    expect(result.confidence).toBe("low");
  });
});

describe("scoreCandidate — distance sensitivity", () => {
  it("scores a nearby sighting higher than a far sighting, all else equal", () => {
    const query = baseQuery();
    const near = baseCandidate({
      lastSighting: { ...baseCandidate().lastSighting, lat: 1.3522, lng: 103.8199 },
    });
    const far = baseCandidate({
      lastSighting: { ...baseCandidate().lastSighting, lat: 1.5, lng: 104.2 },
    });
    const nearScore = scoreCandidate(query, near).similarityScore;
    const farScore = scoreCandidate(query, far).similarityScore;
    expect(nearScore).toBeGreaterThan(farScore);
  });
});

describe("scoreCandidate — recency sensitivity", () => {
  it("scores a recent sighting higher than an old sighting, all else equal", () => {
    const query = baseQuery();
    const recent = baseCandidate({
      lastSighting: { ...baseCandidate().lastSighting, occurredAt: new Date("2026-01-14T12:00:00Z").toISOString() },
    });
    const old = baseCandidate({
      lastSighting: { ...baseCandidate().lastSighting, occurredAt: new Date("2025-06-01T12:00:00Z").toISOString() },
    });
    const recentScore = scoreCandidate(query, recent).similarityScore;
    const oldScore = scoreCandidate(query, old).similarityScore;
    expect(recentScore).toBeGreaterThan(oldScore);
  });
});

describe("scoreCandidate — unknown fields do not unfairly punish", () => {
  it("scores an unknown age group candidate no worse than a fully-specified mismatch would", () => {
    const query = baseQuery({ ageGroup: "adult" });
    const unknownAge = baseCandidate({ ageGroup: "unknown" });
    const mismatchAge = baseCandidate({ ageGroup: "kitten" });

    const unknownScore = scoreCandidate(query, unknownAge).similarityScore;
    const mismatchScore = scoreCandidate(query, mismatchAge).similarityScore;

    expect(unknownScore).toBeGreaterThanOrEqual(mismatchScore);
  });

  it("scores empty distinguishing marks/condition tags as neutral, not penalised", () => {
    const query = baseQuery({ distinguishingMarks: [], conditionTags: [] });
    const candidate = baseCandidate({
      distinguishingMarks: [],
      lastSighting: { ...baseCandidate().lastSighting, conditionTags: [] },
    });
    const result = scoreCandidate(query, candidate);
    // All other signals identical -> should still score very high despite no
    // marks/condition data on either side.
    expect(result.similarityScore).toBeGreaterThanOrEqual(90);
  });
});

describe("scoreCandidate — distinguishing marks improve score", () => {
  it("scores higher when a rare distinguishing mark matches", () => {
    const query = baseQuery({ distinguishingMarks: ["notched right ear", "white chest patch"] });
    const withMatchingMark = baseCandidate({ distinguishingMarks: ["notched right ear", "white chest patch"] });
    const withoutMatchingMark = baseCandidate({ distinguishingMarks: ["long tail"] });

    const withScore = scoreCandidate(query, withMatchingMark).similarityScore;
    const withoutScore = scoreCandidate(query, withoutMatchingMark).similarityScore;

    expect(withScore).toBeGreaterThan(withoutScore);
  });
});

describe("scoreCandidate — ear-tip mismatch caps confidence", () => {
  it("caps the score when ear-tip status disagrees, even if everything else matches", () => {
    const query = baseQuery({ earTipped: false });
    const candidate = baseCandidate({ earTipped: true });
    const result = scoreCandidate(query, candidate);
    expect(result.similarityScore).toBeLessThanOrEqual(60);
    expect(result.reasons.some((r) => r.signal === "Ear-tip status")).toBe(true);
  });
});

describe("findPossibleMatches", () => {
  it("filters out candidates below the threshold and sorts descending", () => {
    const query = baseQuery();
    const strong = baseCandidate({ catId: "strong" });
    const weak = baseCandidate({
      catId: "weak",
      coatColor: "black",
      furPattern: "solid",
      distinguishingMarks: [],
      lastSighting: {
        lat: 10,
        lng: 10,
        occurredAt: new Date("2020-01-01").toISOString(),
        conditionTags: [],
        urgency: "low",
      },
    });
    const results = findPossibleMatches(query, [weak, strong]);
    expect(results.every((r) => r.similarityScore >= MATCH_THRESHOLD)).toBe(true);
    expect(results[0]?.candidateCatId).toBe("strong");
  });

  it("returns at most 5 candidates", () => {
    const query = baseQuery();
    const candidates = Array.from({ length: 10 }, (_, i) => baseCandidate({ catId: `cat-${i}` }));
    const results = findPossibleMatches(query, candidates);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("every returned candidate includes the required disclaimer and reasons", () => {
    const query = baseQuery();
    const results = findPossibleMatches(query, [baseCandidate()]);
    for (const r of results) {
      expect(r.disclaimer).toBe("Possible match — human confirmation required");
      expect(Array.isArray(r.reasons)).toBe(true);
      expect(r.reasons.length).toBeGreaterThan(0);
    }
  });
});
