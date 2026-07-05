"use server";

import { createClient } from "@/lib/supabase/server";
import { updateUserRoleSchema, type UpdateUserRoleInput } from "@/lib/validation/schemas";

export type UpdateUserRoleResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * Change a user's role/approval/org. Delegates to the `update_user_role`
 * SECURITY DEFINER RPC (migration 0010), which:
 *   - requires the caller to be admin (checked independently of RLS, since
 *     this write also needs to bypass `enforce_profile_guard`'s "only admin"
 *     check being satisfied by the caller — belt-and-suspenders, both checks
 *     must pass for a genuine admin);
 *   - refuses to let an admin remove their OWN admin role (self-demotion
 *     guard), preventing an admin from accidentally locking themselves out;
 *   - writes an explicit `audit_logs` row with the before/after role,
 *     approval, and org values.
 */
export async function updateUserRole(input: UpdateUserRoleInput): Promise<UpdateUserRoleResult> {
  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase.rpc("update_user_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_is_approved: parsed.data.isApproved,
    p_org_id: parsed.data.orgId ?? null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not update this user's role." };
  }

  return { ok: true, userId: data };
}
