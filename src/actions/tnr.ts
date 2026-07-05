"use server";

import { createClient } from "@/lib/supabase/server";
import { tnrRecordSchema, type TnrRecordInput } from "@/lib/validation/schemas";

export type UpdateTnrRecordResult =
  | { ok: true; recordId: string }
  | { ok: false; error: string };

/**
 * Create or update the TNR record for a case. Delegates to the
 * `update_tnr_record` RPC (requires case access), which also:
 *   - appends a "TNR status updated to X" case_events row;
 *   - if status reaches 'released', promotes the cat/case status to
 *     'released' UNLESS the cat is already 'adopted' or 'closed' (never
 *     regresses a resolved outcome);
 *   - notifies the cat's followers.
 */
export async function updateTnrRecord(input: TnrRecordInput): Promise<UpdateTnrRecordResult> {
  const parsed = tnrRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to update TNR status." };

  const { data, error } = await supabase.rpc("update_tnr_record", {
    p_case_id: parsed.data.caseId,
    p_tnr_status: parsed.data.tnrStatus,
    p_clinic: parsed.data.clinic ?? null,
    p_scheduled_at: parsed.data.scheduledAt ?? null,
    p_trapped_at: parsed.data.trappedAt ?? null,
    p_neutered_at: parsed.data.neuteredAt ?? null,
    p_returned_at: parsed.data.returnedAt ?? null,
    p_notes: parsed.data.notes ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not update the TNR record." };
  }

  return { ok: true, recordId: data };
}
