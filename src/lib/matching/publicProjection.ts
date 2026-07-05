import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MatchResult, PublicMatchCandidate } from "@/lib/matching/types";
import { getCatPhotoPublicUrl } from "@/lib/storage/catPhotos";
import { publicAreaLabel } from "@/lib/geo/location";

/**
 * Converts engine MatchResult[] into the public-safe shape sent to the
 * client: adds display fields (photo URL, status, area label) but NEVER
 * includes precise coordinates. The area label is derived from the cat's
 * fuzzed map position (via `cats_map_public`), not from any raw sightings
 * row, so this function cannot leak precision even by mistake.
 */
export async function toPublicMatchCandidates(
  supabase: SupabaseClient<Database>,
  results: MatchResult[]
): Promise<PublicMatchCandidate[]> {
  if (results.length === 0) return [];

  const catIds = results.map((r) => r.candidateCatId);
  const { data: mapRows } = await supabase
    .from("cats_map_public")
    .select("*")
    .in("cat_id", catIds);

  const byCatId = new Map((mapRows ?? []).map((row) => [row.cat_id, row]));

  const photoIds = [...new Set((mapRows ?? []).map((r) => r.primary_photo_id).filter(Boolean))] as string[];
  const { data: photoRows } =
    photoIds.length > 0
      ? await supabase.from("photos").select("id, storage_path").in("id", photoIds)
      : { data: [] };
  const photoUrlById = new Map(
    (photoRows ?? []).map((p) => [p.id, getCatPhotoPublicUrl(supabase, p.storage_path)])
  );

  return results.map((result) => {
    const mapRow = byCatId.get(result.candidateCatId);
    return {
      candidateCatId: result.candidateCatId,
      similarityScore: result.similarityScore,
      confidence: result.confidence,
      reasons: result.reasons,
      disclaimer: result.disclaimer,
      photoUrl: mapRow?.primary_photo_id ? photoUrlById.get(mapRow.primary_photo_id) ?? null : null,
      status: mapRow?.status ?? "reported",
      coatColor: mapRow?.coat_color ?? "other",
      furPattern: mapRow?.fur_pattern ?? "other",
      lastSeenAt: mapRow?.last_seen_at ?? new Date().toISOString(),
      areaLabel: mapRow ? publicAreaLabel(mapRow.fuzzed_lat, mapRow.fuzzed_lng) : "Unknown area",
    };
  });
}
