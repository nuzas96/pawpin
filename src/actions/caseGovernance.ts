"use server";

import { createClient } from "@/lib/supabase/server";
import {
  closeCaseSchema,
  reopenCaseSchema,
  archiveCaseSchema,
  reassignCaseSchema,
  releaseClaimSchema,
  type CloseCaseInput,
  type ReopenCaseInput,
  type ArchiveCaseInput,
  type ReassignCaseInput,
  type ReleaseClaimInput,
} from "@/lib/validation/schemas";

export type CaseGovernanceResult = { ok: true; caseId: string } | { ok: false; error: string };

/**
 * Close a case. Delegates to the `close_case` RPC (admin or authorised
 * carer), which sets status='closed', appends a case_events row, and writes
 * an audit_logs row.
 */
export async function closeCase(input: CloseCaseInput): Promise<CaseGovernanceResult> {
  const parsed = closeCaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("close_case", {
    p_case_id: parsed.data.caseId,
    p_note: parsed.data.note ?? null,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not close this case." };
  return { ok: true, caseId: data };
}

/**
 * Reopen a closed or archived case. Delegates to the `reopen_case` RPC,
 * which refuses to reopen a case in any other status (e.g. a case already
 * `adopted`/`released` should be corrected via the adoption/TNR workflow,
 * not reopened directly, to avoid contradicting a resolved outcome).
 */
export async function reopenCase(input: ReopenCaseInput): Promise<CaseGovernanceResult> {
  const parsed = reopenCaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("reopen_case", {
    p_case_id: parsed.data.caseId,
    p_note: parsed.data.note ?? null,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not reopen this case." };
  return { ok: true, caseId: data };
}

/**
 * Archive a case (stale/duplicate/no-longer-actionable, distinct from a
 * resolved 'closed' outcome). Delegates to the `archive_case` RPC.
 */
export async function archiveCase(input: ArchiveCaseInput): Promise<CaseGovernanceResult> {
  const parsed = archiveCaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("archive_case", {
    p_case_id: parsed.data.caseId,
    p_note: parsed.data.note ?? null,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not archive this case." };
  return { ok: true, caseId: data };
}

/**
 * Reassign a case to a different volunteer/org member/admin. Delegates to
 * the `reassign_case` RPC (admin or a member of the case's own org), which
 * validates the target user's role before assigning.
 */
export async function reassignCase(input: ReassignCaseInput): Promise<CaseGovernanceResult> {
  const parsed = reassignCaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("reassign_case", {
    p_case_id: parsed.data.caseId,
    p_new_claimed_by: parsed.data.newClaimedBy,
    p_note: parsed.data.note ?? null,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not reassign this case." };
  return { ok: true, caseId: data };
}

/**
 * Release a claim, returning the case to the unclaimed pool. Delegates to
 * the `release_claim` RPC (the claiming volunteer, or admin).
 */
export async function releaseClaim(input: ReleaseClaimInput): Promise<CaseGovernanceResult> {
  const parsed = releaseClaimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("release_claim", {
    p_case_id: parsed.data.caseId,
    p_note: parsed.data.note ?? null,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Could not release this claim." };
  return { ok: true, caseId: data };
}
