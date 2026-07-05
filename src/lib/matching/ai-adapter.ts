import "server-only";

import type { MatchQuery, MatchCandidate } from "@/lib/matching/types";

/**
 * Optional AI enhancement adapter — a skeleton only, per M3 scope.
 *
 * PawPin's matching is heuristic-assisted, not perfect AI recognition, and is
 * fully functional without this adapter. If `GEMINI_API_KEY` is set, this
 * module is where a future milestone would plug in visual similarity
 * analysis (e.g. comparing the new sighting's photo against a candidate
 * cat's primary photo) to produce a supplementary signal. Without a key, it
 * is a strict no-op — callers must treat a null return as "no AI signal
 * available" and rely entirely on the deterministic engine.
 *
 * This module intentionally makes no network calls today.
 */

export interface AiAssistScore {
  /** Supplementary similarity in [0, 1], intended to nudge — never replace — the heuristic score. */
  visualSimilarity: number;
  /** Short, human-readable note suitable for display alongside heuristic reasons. */
  note: string;
}

export function isAiMatchingEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Returns a supplementary AI-assisted score, or null if AI matching is not
 * configured (no `GEMINI_API_KEY`) or not yet implemented for this signal.
 *
 * Current milestone (M3): always returns null. The interface exists so a
 * later milestone can implement real visual analysis without changing the
 * calling code in the matching engine or server actions.
 */
export async function getAiAssistScore(
  _query: MatchQuery,
  _candidate: MatchCandidate,
  _photoUrls?: { queryPhotoUrl?: string | null; candidatePhotoUrl?: string | null }
): Promise<AiAssistScore | null> {
  if (!isAiMatchingEnabled()) return null;

  // Placeholder for a future milestone: call the Gemini API with the query
  // and candidate photos to obtain a visual similarity score. Left
  // unimplemented deliberately for M3 — see docs/architecture.md §"Matching
  // engine" for the documented scope decision.
  return null;
}
