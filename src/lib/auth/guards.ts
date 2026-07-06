import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ROLE, isStoredRole, type StoredRole } from "@/lib/auth/roles";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export type SessionUser = {
  id: string;
  email: string | null;
  role: StoredRole;
  displayName: string | null;
  isApproved: boolean;
};

/**
 * Returns the current signed-in user with their profile role, or null if the
 * visitor is a guest (unauthenticated). Never throws for guests.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, is_approved")
    .eq("id", user.id)
    .maybeSingle();

  const role = isStoredRole(profile?.role) ? profile!.role : DEFAULT_ROLE;

  return {
    id: user.id,
    email: user.email ?? null,
    role,
    displayName: profile?.display_name ?? null,
    isApproved: profile?.is_approved ?? false,
  };
}

/** Require an authenticated user; redirect guests to sign in. */
export async function requireUser(redirectTo = "/auth/sign-in"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(getSafeRedirectPath(redirectTo, "/auth/sign-in"));
  return user;
}

/**
 * Require one of the allowed roles. Guests are redirected to sign in;
 * authenticated users lacking the role are redirected to their profile.
 */
export async function requireRole(allowed: StoredRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/sign-in");
  if (!allowed.includes(user.role)) redirect("/profile");
  return user;
}
