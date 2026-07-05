import type {
  AgeGroup,
  CoatColor,
  FurPattern,
  SizeClass,
  UrgencyLevel,
} from "@/types/database";

/**
 * Matching engine types. The engine is a pure, deterministic TypeScript
 * module (no external API calls) that compares a new sighting against
 * candidate cat profiles and produces an explainable similarity score.
 *
 * IMPORTANT WORDING CONTRACT (see docs/architecture.md):
 * PawPin never claims certain identification. All matching output must be
 * framed as a "possible match" requiring human confirmation. Never use
 * phrasing like "same cat detected" or "AI identified the cat".
 */

export type Confidence = "low" | "medium" | "high";

/** Traits + context describing the new sighting being matched. */
export interface MatchQuery {
  lat: number;
  lng: number;
  occurredAt: string; // ISO timestamp of the new sighting
  coatColor: CoatColor;
  furPattern: FurPattern;
  sizeClass: SizeClass;
  ageGroup: AgeGroup;
  earTipped: boolean;
  distinguishingMarks: string[];
  conditionTags: string[];
}

/** A candidate cat profile with its most relevant prior sighting, used for scoring. */
export interface MatchCandidate {
  catId: string;
  coatColor: CoatColor;
  furPattern: FurPattern;
  sizeClass: SizeClass;
  ageGroup: AgeGroup;
  earTipped: boolean;
  distinguishingMarks: string[];
  /** Most recent prior sighting used for distance/recency/condition comparison. */
  lastSighting: {
    lat: number;
    lng: number;
    occurredAt: string;
    conditionTags: string[];
    urgency: UrgencyLevel;
  };
}

export interface MatchReason {
  signal: string;
  contribution: number;
  detail: string;
}

export interface MatchResult {
  candidateCatId: string;
  similarityScore: number;
  confidence: Confidence;
  reasons: MatchReason[];
  disclaimer: "Possible match — human confirmation required";
}

/** Public-safe projection of a MatchResult, extended with display fields. Never includes raw coordinates. */
export interface PublicMatchCandidate {
  candidateCatId: string;
  similarityScore: number;
  confidence: Confidence;
  reasons: MatchReason[];
  disclaimer: "Possible match — human confirmation required";
  photoUrl: string | null;
  status: string;
  coatColor: CoatColor;
  furPattern: FurPattern;
  lastSeenAt: string;
  areaLabel: string;
}
