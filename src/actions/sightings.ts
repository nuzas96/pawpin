"use server";

import { createClient } from "@/lib/supabase/server";
import { sightingSchema, type SightingInput } from "@/lib/validation/schemas";
import { uploadCatPhoto } from "@/lib/storage/catPhotos";
import { publicAreaLabel } from "@/lib/geo/location";
import { searchMatchCandidates } from "@/lib/matching/candidateSearch";
import { findPossibleMatches } from "@/lib/matching/engine";
import { toPublicMatchCandidates } from "@/lib/matching/publicProjection";
import type { PublicMatchCandidate } from "@/lib/matching/types";

export type CreateSightingResult =
  | {
      ok: true;
      sightingId: string;
      areaLabel: string;
      candidates: PublicMatchCandidate[];
    }
  | { ok: false; error: string };

/**
 * Server action for the M3 report flow.
 *
 * Behavior change from M2: this action no longer auto-creates a cat profile.
 * It creates a PENDING sighting (cat_id = NULL), runs the heuristic matching
 * engine against nearby/recent cats, and returns possible-match candidates
 * (public-safe projection only — no precise coordinates) to the client. The
 * reporter then chooses, via a separate server action, to either:
 *   - linkSightingToCatProfile (an existing cat), or
 *   - createCatProfileFromSighting (a brand-new cat).
 *
 * This avoids creating duplicate cat profiles before a human decides.
 *
 * Scope for this milestone:
 * - Requires an authenticated session (guest reporting remains M3/M4
 *   hardening — see docs/security-report.md).
 * - Never trusts client input — re-validates with `sightingSchema`.
 * - Precise lat/lng are stored only in `sightings` (RLS-protected). Matching
 *   runs server-side against precise data; only fuzzed/public fields are
 *   returned to the client via `toPublicMatchCandidates`.
 */
export async function createSighting(
  input: SightingInput,
  photo?: { bytes: Uint8Array; type: string; size: number; name?: string }
): Promise<CreateSightingResult> {
  const parsed = sightingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid report data." };
  }
  const data = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to submit a report in this version of PawPin.",
    };
  }

  // 1. Upload photo (optional) and record its metadata row.
  let photoId: string | undefined = data.photoId;
  if (photo) {
    const uploadResult = await uploadCatPhoto(supabase, {
      uploaderId: user.id,
      file: { type: photo.type, size: photo.size, name: photo.name },
      bytes: photo.bytes,
    });
    if (!uploadResult.ok) {
      return { ok: false, error: uploadResult.error };
    }
    photoId = uploadResult.photoId;
  }

  // 2. Create the PENDING sighting (cat_id left NULL — no cat/case yet).
  const nowIso = new Date().toISOString();
  const { data: sighting, error: sightingError } = await supabase
    .from("sightings")
    .insert({
      cat_id: null,
      reporter_id: user.id,
      photo_id: photoId ?? null,
      lat: data.lat,
      lng: data.lng,
      urgency: data.urgency,
      condition_tags: data.conditionTags,
      notes: data.notes ?? null,
    })
    .select("id, created_at")
    .single();

  if (sightingError || !sighting) {
    return { ok: false, error: `Could not save sighting: ${sightingError?.message ?? "unknown error"}` };
  }

  // 3. Server-side candidate search + deterministic matching.
  const rawCandidates = await searchMatchCandidates(supabase, { lat: data.lat, lng: data.lng });
  const matches = findPossibleMatches(
    {
      lat: data.lat,
      lng: data.lng,
      occurredAt: sighting.created_at ?? nowIso,
      coatColor: data.traits.coatColor,
      furPattern: data.traits.furPattern,
      sizeClass: data.traits.sizeClass,
      ageGroup: data.traits.ageGroup,
      earTipped: data.traits.earTipped,
      distinguishingMarks: data.traits.distinguishingMarks,
      conditionTags: data.conditionTags,
    },
    rawCandidates
  );

  // 4. Persist the match suggestions (decision starts as "pending").
  //    The link RPC requires a suggestion row to exist for the chosen cat, so
  //    if this persistence fails we must fail the whole step rather than
  //    return candidates the reporter would then be unable to link. The
  //    pending sighting left behind is invisible in the UI (no cat/case) and
  //    harmless; the reporter can simply submit again.
  if (matches.length > 0) {
    const { error: suggestionsError } = await supabase.from("match_suggestions").insert(
      matches.map((m) => ({
        sighting_id: sighting.id,
        candidate_cat_id: m.candidateCatId,
        score: m.similarityScore,
        reasons: m.reasons,
        decision: "pending" as const,
      }))
    );
    if (suggestionsError) {
      return { ok: false, error: `Could not prepare match suggestions: ${suggestionsError.message}` };
    }
  }

  const candidates = await toPublicMatchCandidates(supabase, matches);

  return {
    ok: true,
    sightingId: sighting.id,
    areaLabel: publicAreaLabel(data.lat, data.lng),
    candidates,
  };
}
