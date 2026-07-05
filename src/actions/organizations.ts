"use server";

import { createClient } from "@/lib/supabase/server";
import {
  approveOrganizationSchema,
  rejectOrganizationSchema,
  type ApproveOrganizationInput,
  type RejectOrganizationInput,
} from "@/lib/validation/schemas";

export type OrgActionResult =
  | { ok: true; orgId: string }
  | { ok: false; error: string };

/**
 * Approve a pending rescue organisation. Delegates to the
 * `approve_organization` RPC (admin-only), which sets `is_approved = true`,
 * records `verified_by`/`admin_note`, and writes an audit_logs row.
 */
export async function approveOrganisation(input: ApproveOrganizationInput): Promise<OrgActionResult> {
  const parsed = approveOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("approve_organization", {
    p_org_id: parsed.data.orgId,
    p_note: parsed.data.note ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not approve this organisation." };
  }

  return { ok: true, orgId: data };
}

/**
 * Reject a pending rescue organisation. Delegates to the
 * `reject_organization` RPC (admin-only), which sets `is_approved = false`
 * with an admin note explaining why, and writes an audit_logs row. The
 * organisation row is preserved (not deleted) so it can be corrected and
 * resubmitted.
 */
export async function rejectOrganisation(input: RejectOrganizationInput): Promise<OrgActionResult> {
  const parsed = rejectOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("reject_organization", {
    p_org_id: parsed.data.orgId,
    p_note: parsed.data.note ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not reject this organisation." };
  }

  return { ok: true, orgId: data };
}
