import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MatchCandidate } from "@/lib/matching/types";

/**
 * Server-side candidate search. Calls the `get_match_candidates` Postgres
 * function (SECURITY DEFINER, granted only to `authenticated`) to find cats
 * with a geographically-plausible, recent-enough prior sighting, using a
 * bounding-box pre-filter in SQL. The precise coordinates returned here are
 * used ONLY for in-memory scoring in `src/lib/matching/engine.ts` and are
 * never forwarded to the browser — see `src/actions/sightings.ts`, which
 * reduces results to `PublicMatchCandidate` (fuzzed/area-label only) before
 * returning anything to the client.
 */
export async function searchMatchCandidates(
  supabase: SupabaseClient<Database>,
  params: { lat: number; lng: number; maxDistanceMeters?: number; maxAgeDays?: number }
): Promise<MatchCandidate[]> {
  const { data, error } = await supabase.rpc("get_match_candidates", {
    query_lat: params.lat,
    query_lng: params.lng,
    max_distance_meters: params.maxDistanceMeters ?? 3000,
    max_age_days: params.maxAgeDays ?? 120,
  });

  if (error || !data) {
    // Fail closed: no candidates rather than surfacing a raw DB error to the
    // matching flow. The caller falls back to "no likely match found".
    return [];
  }

  return data.map((row) => ({
    catId: row.cat_id,
    coatColor: row.coat_color,
    furPattern: row.fur_pattern,
    sizeClass: row.size_class,
    ageGroup: row.age_group,
    earTipped: row.ear_tipped,
    distinguishingMarks: row.distinguishing_marks,
    lastSighting: {
      lat: row.sighting_lat,
      lng: row.sighting_lng,
      occurredAt: row.sighting_occurred_at,
      conditionTags: row.sighting_condition_tags,
      urgency: row.sighting_urgency,
    },
  }));
}
