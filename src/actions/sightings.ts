"use server";

import { createClient } from "@/lib/supabase/server";
import { sightingSchema, type SightingInput } from "@/lib/validation/schemas";
import { uploadCatPhoto } from "@/lib/storage/catPhotos";
import { publicAreaLabel } from "@/lib/geo/location";

export type CreateSightingResult =
  | {
      ok: true;
      catId: string;
      caseId: string;
      sightingId: string;
      areaLabel: string;
    }
  | { ok: false; error: string };

/**
 * Server action for the M2 report flow.
 *
 * Scope for this milestone:
 * - Requires an authenticated session (see docs/security-report.md — guest
 *   reporting is documented as M3/M4 hardening; the RLS insert policies for
 *   `sightings`/`cats`/`cases` currently require `authenticated`).
 * - No matching engine yet (M3): every report creates a brand-new cat profile
 *   and a brand-new case tied to it.
 * - Never trusts client input — re-validates with `sightingSchema`.
 * - Precise lat/lng are stored only in `sightings` (RLS-protected). The public
 *   map reads fuzzed data through `cats_map_public` / `sighting_geo_public`.
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

  // 2. Create a new cat profile for this sighting (no matching engine yet).
  const { data: cat, error: catError } = await supabase
    .from("cats")
    .insert({
      status: "reported",
      coat_color: data.traits.coatColor,
      fur_pattern: data.traits.furPattern,
      size_class: data.traits.sizeClass,
      age_group: data.traits.ageGroup,
      distinguishing_marks: data.traits.distinguishingMarks,
      ear_tipped: data.traits.earTipped,
      primary_photo_id: photoId ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (catError || !cat) {
    return { ok: false, error: `Could not create cat profile: ${catError?.message ?? "unknown error"}` };
  }

  // 3. Create the sighting (precise coordinates; RLS-protected).
  const { data: sighting, error: sightingError } = await supabase
    .from("sightings")
    .insert({
      cat_id: cat.id,
      reporter_id: user.id,
      photo_id: photoId ?? null,
      lat: data.lat,
      lng: data.lng,
      urgency: data.urgency,
      condition_tags: data.conditionTags,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();

  if (sightingError || !sighting) {
    return { ok: false, error: `Could not save sighting: ${sightingError?.message ?? "unknown error"}` };
  }

  // 4. Open a case for this cat.
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .insert({
      cat_id: cat.id,
      status: "reported",
      priority: data.urgency,
    })
    .select("id")
    .single();

  if (caseError || !caseRow) {
    return { ok: false, error: `Could not open a case: ${caseError?.message ?? "unknown error"}` };
  }

  // 5. Append the initial timeline event.
  const { error: eventError } = await supabase.from("case_events").insert({
    case_id: caseRow.id,
    type: "initial_sighting",
    actor_id: user.id,
    payload: {
      message: "Initial sighting reported",
      sighting_id: sighting.id,
    },
  });

  if (eventError) {
    return { ok: false, error: `Could not record case timeline: ${eventError.message}` };
  }

  return {
    ok: true,
    catId: cat.id,
    caseId: caseRow.id,
    sightingId: sighting.id,
    areaLabel: publicAreaLabel(data.lat, data.lng),
  };
}
