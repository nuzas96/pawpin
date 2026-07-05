/**
 * Role model for PawPin.
 *
 * "guest" is NOT a stored database role — it represents an unauthenticated
 * visitor. Stored roles (in public.profiles.role) are only: user, volunteer,
 * org, admin. Access control is enforced primarily by Postgres RLS; these
 * helpers provide a defense-in-depth layer in the application code / UI.
 */

export const STORED_ROLES = ["user", "volunteer", "org", "admin"] as const;
export type StoredRole = (typeof STORED_ROLES)[number];

// Includes the implicit unauthenticated role for UI logic only.
export type Role = StoredRole | "guest";

export const DEFAULT_ROLE: StoredRole = "user";

/** Simple hierarchy for "at least this role" checks (admin is highest). */
const RANK: Record<StoredRole, number> = {
  user: 1,
  volunteer: 2,
  org: 2,
  admin: 3,
};

export function isStoredRole(value: unknown): value is StoredRole {
  return (
    typeof value === "string" && (STORED_ROLES as readonly string[]).includes(value)
  );
}

export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

export function isVolunteer(role: Role | null | undefined): boolean {
  return role === "volunteer";
}

export function isOrg(role: Role | null | undefined): boolean {
  return role === "org";
}

/** True if the role has at least the rank of `minimum`. Guest always false. */
export function hasAtLeast(role: Role | null | undefined, minimum: StoredRole): boolean {
  if (!role || role === "guest") return false;
  return RANK[role] >= RANK[minimum];
}

export const ROLE_LABELS: Record<Role, string> = {
  guest: "Guest",
  user: "Registered User",
  volunteer: "Volunteer",
  org: "Rescue Organisation",
  admin: "Admin",
};
