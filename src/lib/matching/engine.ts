import type { AgeGroup, CoatColor, FurPattern, SizeClass } from "@/types/database";
import { haversineDistanceMeters } from "@/lib/matching/haversine";
import {
  CONFIDENCE_BANDS,
  DISTANCE_DECAY_METERS,
  EAR_TIP_MISMATCH_CAP,
  MATCH_THRESHOLD,
  MATCH_WEIGHTS,
  MAX_CANDIDATES,
  RECENCY_DECAY_DAYS,
} from "@/lib/matching/weights";
import { buildReasons } from "@/lib/matching/explain";
import type { Confidence, MatchCandidate, MatchQuery, MatchResult } from "@/lib/matching/types";

/**
 * Deterministic heuristic matching engine. Pure function, no I/O, no external
 * API calls — fully functional without any AI key. See
 * src/lib/matching/ai-adapter.ts for the optional (no-op-by-default) enhancer.
 *
 * WORDING CONTRACT: output is always framed as a possible match requiring
 * human confirmation. Never claim certain identification.
 */

// ---------------------------------------------------------------------------
// Per-signal similarity (0..1). Each returns null when the signal cannot be
// meaningfully compared (e.g. an "unknown" age group) — null signals are
// excluded from both the score and the weight total, so unknown data never
// unfairly punishes the candidate.
// ---------------------------------------------------------------------------

const COLOR_SIMILARITY: Partial<Record<CoatColor, Partial<Record<CoatColor, number>>>> = {
  orange: { orange: 1, tabby: 0.5, brown: 0.4, mixed: 0.3 },
  brown: { brown: 1, orange: 0.4, tabby: 0.5, mixed: 0.3 },
  tabby: { tabby: 1, orange: 0.5, brown: 0.5, grey: 0.3, mixed: 0.3 },
  black: { black: 1, mixed: 0.3, tuxedo: 0.4 },
  white: { white: 1, tuxedo: 0.4, mixed: 0.3, calico: 0.2 },
  grey: { grey: 1, tabby: 0.3, mixed: 0.3 },
  calico: { calico: 1, tortoiseshell: 0.5, mixed: 0.3, white: 0.2 },
  tortoiseshell: { tortoiseshell: 1, calico: 0.5, mixed: 0.3 },
  tuxedo: { tuxedo: 1, black: 0.4, white: 0.4, mixed: 0.3 },
  mixed: { mixed: 1 },
  other: { other: 1 },
};

function coatColorSimilarity(a: CoatColor, b: CoatColor): number {
  if (a === b) return 1;
  return COLOR_SIMILARITY[a]?.[b] ?? COLOR_SIMILARITY[b]?.[a] ?? 0;
}

const PATTERN_SIMILARITY: Partial<Record<FurPattern, Partial<Record<FurPattern, number>>>> = {
  solid: { solid: 1, bicolor: 0.2 },
  tabby: { tabby: 1, spotted: 0.3 },
  bicolor: { bicolor: 1, tricolor: 0.4, solid: 0.2 },
  tricolor: { tricolor: 1, bicolor: 0.4 },
  pointed: { pointed: 1 },
  spotted: { spotted: 1, tabby: 0.3 },
  other: { other: 1 },
};

function furPatternSimilarity(a: FurPattern, b: FurPattern): number {
  if (a === b) return 1;
  return PATTERN_SIMILARITY[a]?.[b] ?? PATTERN_SIMILARITY[b]?.[a] ?? 0;
}

const SIZE_ORDER: SizeClass[] = ["kitten", "small", "medium", "large"];
function sizeClassSimilarity(a: SizeClass, b: SizeClass): number {
  if (a === b) return 1;
  const diff = Math.abs(SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  if (diff === 1) return 0.5;
  if (diff === 2) return 0.15;
  return 0;
}

function ageGroupSimilarity(a: AgeGroup, b: AgeGroup): number | null {
  if (a === "unknown" || b === "unknown") return null; // unknown never punishes
  if (a === b) return 1;
  const order: AgeGroup[] = ["kitten", "juvenile", "adult", "senior"];
  const diff = Math.abs(order.indexOf(a) - order.indexOf(b));
  if (diff === 1) return 0.5;
  return 0.1;
}

/** Jaccard-style overlap of two string-array signals (marks, condition tags), case-insensitive. */
function overlapSimilarity(a: string[], b: string[]): number | null {
  if (a.length === 0 && b.length === 0) return null; // nothing to compare; unknown, don't punish
  const setA = new Set(a.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const setB = new Set(b.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return null;
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? null : intersection / union;
}

function distanceSimilarity(meters: number): number {
  // Exponential decay: 1.0 at 0m, 0.5 at DISTANCE_DECAY_METERS, approaches 0.
  return Math.exp(-meters / DISTANCE_DECAY_METERS);
}

function recencySimilarity(daysAgo: number): number {
  if (daysAgo < 0) return 1; // future/clock skew edge case — don't punish
  return Math.exp(-daysAgo / RECENCY_DECAY_DAYS);
}

function bandConfidence(score: number): Confidence {
  if (score >= CONFIDENCE_BANDS.high) return "high";
  if (score >= CONFIDENCE_BANDS.medium) return "medium";
  return "low";
}

/**
 * Score a single candidate against the query sighting. Returns a MatchResult
 * even for low scores; callers apply MATCH_THRESHOLD to decide what to show.
 */
export function scoreCandidate(query: MatchQuery, candidate: MatchCandidate): MatchResult {
  const distanceMeters = haversineDistanceMeters(
    query.lat,
    query.lng,
    candidate.lastSighting.lat,
    candidate.lastSighting.lng
  );
  const daysAgo =
    (new Date(query.occurredAt).getTime() - new Date(candidate.lastSighting.occurredAt).getTime()) /
    (1000 * 60 * 60 * 24);

  const signals: { key: keyof typeof MATCH_WEIGHTS; similarity: number | null }[] = [
    { key: "coatColor", similarity: coatColorSimilarity(query.coatColor, candidate.coatColor) },
    { key: "furPattern", similarity: furPatternSimilarity(query.furPattern, candidate.furPattern) },
    { key: "sizeClass", similarity: sizeClassSimilarity(query.sizeClass, candidate.sizeClass) },
    { key: "ageGroup", similarity: ageGroupSimilarity(query.ageGroup, candidate.ageGroup) },
    {
      key: "distinguishingMarks",
      similarity: overlapSimilarity(query.distinguishingMarks, candidate.distinguishingMarks),
    },
    { key: "distance", similarity: distanceSimilarity(distanceMeters) },
    { key: "recency", similarity: recencySimilarity(daysAgo) },
    {
      key: "conditionTags",
      similarity: overlapSimilarity(query.conditionTags, candidate.lastSighting.conditionTags),
    },
  ];

  let earnedPoints = 0;
  let availableWeight = 0;
  const contributions: { key: string; similarity: number; weight: number; contribution: number }[] = [];

  for (const { key, similarity } of signals) {
    if (similarity === null) continue; // unknown signal: excluded from both numerator and denominator
    const weight = MATCH_WEIGHTS[key];
    const contribution = similarity * weight;
    earnedPoints += contribution;
    availableWeight += weight;
    contributions.push({ key, similarity, weight, contribution });
  }

  // Re-normalise against the weight actually available so missing/unknown
  // fields never unfairly punish the score (rather than just capping <100).
  let similarityScore = availableWeight > 0 ? Math.round((earnedPoints / availableWeight) * 100) : 0;

  // Ear-tip mismatch cap: if both are known and disagree, cap the score.
  const earTipKnownForBoth = true; // both `earTipped` booleans are always known (default false)
  const earTipMismatch = earTipKnownForBoth && query.earTipped !== candidate.earTipped;
  if (earTipMismatch) {
    similarityScore = Math.min(similarityScore, EAR_TIP_MISMATCH_CAP);
  }

  similarityScore = Math.max(0, Math.min(100, similarityScore));

  const reasons = buildReasons({
    contributions,
    distanceMeters,
    daysAgo,
    earTipMismatch,
  });

  return {
    candidateCatId: candidate.catId,
    similarityScore,
    confidence: bandConfidence(similarityScore),
    reasons,
    disclaimer: "Possible match — human confirmation required",
  };
}

/**
 * Score all candidates, filter to those above MATCH_THRESHOLD, sort
 * descending, and cap to MAX_CANDIDATES.
 */
export function findPossibleMatches(query: MatchQuery, candidates: MatchCandidate[]): MatchResult[] {
  return candidates
    .map((candidate) => scoreCandidate(query, candidate))
    .filter((result) => result.similarityScore >= MATCH_THRESHOLD)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, MAX_CANDIDATES);
}
