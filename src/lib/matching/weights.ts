/**
 * Matching engine weights. Total sums to 100 (a perfect match on every signal
 * yields similarityScore = 100). Tuned to be explainable and conservative —
 * distinguishing marks and coat colour dominate because they are the most
 * reliable visual signals a human reporter can actually observe.
 */
export const MATCH_WEIGHTS = {
  coatColor: 22,
  furPattern: 15,
  sizeClass: 12,
  ageGroup: 8,
  distinguishingMarks: 18,
  distance: 15,
  recency: 6,
  conditionTags: 4,
} as const;

export const TOTAL_WEIGHT = Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0);

/** Minimum score for a candidate to be surfaced to the reporter at all. */
export const MATCH_THRESHOLD = 45;

/** Maximum number of candidates returned, sorted by score descending. */
export const MAX_CANDIDATES = 5;

/**
 * Confidence banding thresholds. These are intentionally conservative: even a
 * numerically high score is only ever "high" confidence, never certainty.
 */
export const CONFIDENCE_BANDS = {
  high: 75,
  medium: 55,
} as const;

/**
 * Distance decay half-distance in metres: score contribution halves every
 * this many metres. Chosen so a sighting a couple of blocks away still scores
 * reasonably, but a sighting kilometres away contributes almost nothing.
 */
export const DISTANCE_DECAY_METERS = 600;

/** Recency decay half-life in days: score contribution halves every N days. */
export const RECENCY_DECAY_DAYS = 14;

/**
 * If ear-tipped status is known for both cat and candidate and they disagree,
 * cap the final similarity score at this value regardless of other signals —
 * an ear-tip mismatch may indicate a different TNR status entirely.
 */
export const EAR_TIP_MISMATCH_CAP = 60;
