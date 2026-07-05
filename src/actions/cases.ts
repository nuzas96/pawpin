"use server";

import { createClient } from "@/lib/supabase/server";
import { claimCaseSchema, caseUpdateSchema, type ClaimCaseInput, type CaseUpdateInput } from "@/lib/validation/schemas";

export type ClaimCaseResult =
  | { ok: true; caseId: string }
  | { ok: false; error: string };

export type AddCaseUpdateResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

/**
 * Claim an open case. Delegates to the `claim_case` SECURITY DEFINER RPC
 * (migration 0009), which:
 *   - requires the caller's role to be volunteer/org/admin (a plain
 *     registered user gets a clear rejection, surfaced below);
 *   - rejects double-claiming by a different volunteer unless the caller is
 *     an admin or a member of the case's own organisation (override);
 *   - atomically sets `claimed_by`, promotes `reported -> active`, appends a
 *     "Case claimed by volunteer" case_events row, and notifies followers.
 *
 * The RPC pattern (rather than a direct table update from here) is required
 * because a volunteer who has not yet claimed the case has no
 * `has_case_access()` under RLS — see the M3 audit findings for the same
 * class of bug in the matching decision actions.
 */
export async function claimCase(input: ClaimCaseInput): Promise<ClaimCaseResult> {
  const parsed = claimCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to claim a case." };

  const { data, error } = await supabase
    .rpc("claim_case", { p_case_id: parsed.data.caseId })
    .single();

  if (error || !data) {
    const message = error?.message ?? "Could not claim this case.";
    if (message.includes("Only volunteers")) {
      return {
        ok: false,
        error: "Only volunteers, rescue organisations, or admins can claim cases. Ask an admin to grant volunteer access if you'd like to help directly.",
      };
    }
    if (message.includes("already been claimed")) {
      return { ok: false, error: "This case has already been claimed by another volunteer." };
    }
    return { ok: false, error: message };
  }

  return { ok: true, caseId: data.result_case_id };
}

/**
 * Append a categorised case update to the timeline. Delegates to the
 * `add_case_update` RPC, which requires `has_case_access` (claimed volunteer,
 * org member, or admin) and notifies the cat's followers.
 */
export async function addCaseUpdate(input: CaseUpdateInput): Promise<AddCaseUpdateResult> {
  const parsed = caseUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to add a case update." };

  const { data, error } = await supabase.rpc("add_case_update", {
    p_case_id: parsed.data.caseId,
    p_category: parsed.data.category,
    p_note: parsed.data.note,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not add this update." };
  }

  return { ok: true, eventId: data };
}
