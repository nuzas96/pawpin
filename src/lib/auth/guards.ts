import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ROLE, isStoredRole, type StoredRole } from "@/lib/auth/roles";

export type SessionUser = {
  id: string;
  email: string | null;
  role: StoredRole;
  displayName: string | null;
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
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = isStoredRole(profile?.role) ? profile!.role : DEFAULT_ROLE;

  return {
    id: user.id,
    email: user.email ?? null,
    role,
    displayName: profile?.display_name ?? null,
  };
}

/** Require an authenticated user; redirect guests to sign in. */
export async function requireUser(redirectTo = "/auth/sign-in"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(redirectTo);
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
