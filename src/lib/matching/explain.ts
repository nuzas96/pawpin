import type { MatchReason } from "@/lib/matching/types";

const SIGNAL_LABELS: Record<string, string> = {
  coatColor: "Coat colour",
  furPattern: "Fur pattern",
  sizeClass: "Size",
  ageGroup: "Age group",
  distinguishingMarks: "Distinguishing marks",
  distance: "Distance",
  recency: "Recency",
  conditionTags: "Condition tags",
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `~${Math.round(meters)}m from a previous sighting`;
  return `~${(meters / 1000).toFixed(1)}km from a previous sighting`;
}

function formatRecency(daysAgo: number): string {
  if (daysAgo < 1) return "seen earlier today";
  if (daysAgo < 2) return "last seen 1 day ago";
  return `last seen ${Math.round(daysAgo)} days ago`;
}

function detailFor(key: string, similarity: number, distanceMeters: number, daysAgo: number): string {
  switch (key) {
    case "coatColor":
      return similarity >= 0.99 ? "Both reported with the same coat colour" : "Coat colours are similar but not identical";
    case "furPattern":
      return similarity >= 0.99 ? "Both reported with the same fur pattern" : "Fur patterns are similar but not identical";
    case "sizeClass":
      return similarity >= 0.99 ? "Same size class" : "Similar size class";
    case "ageGroup":
      return similarity >= 0.99 ? "Same age group" : "Similar age group";
    case "distinguishingMarks":
      return similarity >= 0.99
        ? "Distinguishing marks closely match"
        : "Some distinguishing marks overlap";
    case "distance":
      return formatDistance(distanceMeters);
    case "recency":
      return formatRecency(daysAgo);
    case "conditionTags":
      return similarity >= 0.99 ? "Condition tags match" : "Some condition tags overlap";
    default:
      return "";
  }
}

/**
 * Build the human-readable reason list for a match result. Reasons are
 * sorted by contribution (highest first) so the strongest evidence for the
 * possible match appears first — this is what a reporter reads to decide
 * whether to confirm the link.
 */
export function buildReasons(params: {
  contributions: { key: string; similarity: number; weight: number; contribution: number }[];
  distanceMeters: number;
  daysAgo: number;
  earTipMismatch: boolean;
}): MatchReason[] {
  const { contributions, distanceMeters, daysAgo, earTipMismatch } = params;

  const reasons: MatchReason[] = contributions
    .filter((c) => c.contribution > 0.05) // omit negligible noise signals
    .sort((a, b) => b.contribution - a.contribution)
    .map((c) => ({
      signal: SIGNAL_LABELS[c.key] ?? c.key,
      contribution: Math.round(c.contribution * 10) / 10,
      detail: detailFor(c.key, c.similarity, distanceMeters, daysAgo),
    }));

  if (earTipMismatch) {
    reasons.push({
      signal: "Ear-tip status",
      contribution: 0,
      detail: "Ear-tip status differs — this may indicate a different TNR status, so confidence is capped",
    });
  }

  return reasons;
}
