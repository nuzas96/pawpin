"use server";

import { createClient } from "@/lib/supabase/server";
import {
  linkSightingSchema,
  createCatFromSightingSchema,
  type LinkSightingInput,
  type CreateCatFromSightingInput,
} from "@/lib/validation/schemas";

export type LinkSightingResult =
  | { ok: true; catId: string; caseId: string }
  | { ok: false; error: string };

export type CreateCatFromSightingResult =
  | { ok: true; catId: string; caseId: string }
  | { ok: false; error: string };

/**
 * Link a pending sighting to an EXISTING cat profile — the "possible match"
 * confirmation path.
 *
 * The actual mutation runs inside the `link_sighting_to_cat` Postgres function
 * (SECURITY DEFINER, migration 0008). That function is used — rather than a
 * sequence of table writes from here — for three reasons found in the M3
 * audit:
 *   1. Correctness: a reporter is not an authorised carer of the target cat,
 *      so RLS would block/no-op the `cats` update, the `case_events` insert,
 *      and the `match_suggestions` decision update if done directly.
 *   2. Atomicity: all writes (link, last_seen bump, case, timeline, decision
 *      trail) happen in one transaction — no partial state.
 *   3. Authorization: the function verifies the caller reported the sighting
 *      (or is admin), the sighting is still pending, and the target cat was
 *      actually a suggested candidate — so a user cannot link to an arbitrary
 *      cat by calling the action directly.
 */
export async function linkSightingToCatProfile(
  input: LinkSightingInput
): Promise<LinkSightingResult> {
  const parsed = linkSightingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { sightingId, catId } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to confirm a match." };

  const { data, error } = await supabase
    .rpc("link_sighting_to_cat", { p_sighting_id: sightingId, p_cat_id: catId })
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not link this sighting." };
  }

  return { ok: true, catId: data.result_cat_id, caseId: data.result_case_id };
}

/**
 * Create a BRAND-NEW cat profile from a pending sighting — used when no likely
 * match was found, or when the reporter rejects all suggested candidates.
 *
 * Runs inside the `create_cat_from_sighting` Postgres function (SECURITY
 * DEFINER, migration 0008) for atomicity (no orphan cat if a later step fails)
 * and to persist the rejection of any pending suggestions in the same
 * transaction.
 */
export async function createCatProfileFromSighting(
  input: CreateCatFromSightingInput
): Promise<CreateCatFromSightingResult> {
  const parsed = createCatFromSightingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { sightingId, traits } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to create a cat profile." };

  const { data, error } = await supabase
    .rpc("create_cat_from_sighting", {
      p_sighting_id: sightingId,
      p_coat_color: traits.coatColor,
      p_fur_pattern: traits.furPattern,
      p_size_class: traits.sizeClass,
      p_age_group: traits.ageGroup,
      p_ear_tipped: traits.earTipped,
      p_marks: traits.distinguishingMarks,
    })
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create a cat profile." };
  }

  return { ok: true, catId: data.result_cat_id, caseId: data.result_case_id };
}
