"use server";

import { createClient } from "@/lib/supabase/server";
import { adoptionSchema, type AdoptionInput } from "@/lib/validation/schemas";

export type UpdateAdoptionRecordResult =
  | { ok: true; recordId: string }
  | { ok: false; error: string };

/**
 * Create or update the adoption record for a cat. Delegates to the
 * `update_adoption_record` RPC (requires `has_cat_access` on the cat), which
 * also:
 *   - appends an "Adoption status updated to X" case_events row;
 *   - if status becomes 'adopted', promotes the cat/case status to 'adopted'
 *     and closes the case, UNLESS the case is already 'closed';
 *   - notifies the cat's followers.
 *
 * `adopterContact` is minimal PII. It is never selectable by the public —
 * RLS on `adoptions` restricts SELECT to admin/`has_cat_access` (see
 * supabase/migrations/0004_rls.sql) — and the cat profile page only ever
 * renders the public `status`, never the contact field.
 */
export async function updateAdoptionRecord(input: AdoptionInput): Promise<UpdateAdoptionRecordResult> {
  const parsed = adoptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to update adoption status." };

  const { data, error } = await supabase.rpc("update_adoption_record", {
    p_cat_id: parsed.data.catId,
    p_status: parsed.data.status,
    p_adopter_contact: parsed.data.adopterContact ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not update the adoption record." };
  }

  return { ok: true, recordId: data };
}
