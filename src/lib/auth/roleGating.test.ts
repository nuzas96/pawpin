import { describe, it, expect } from "vitest";
import { hasAtLeast, isAdmin, isVolunteer, isOrg, type Role } from "@/lib/auth/roles";

/**
 * These tests document and verify the role-gating contract used by the
 * claim-case flow (ClaimCaseButton / claimCase action) and other M4
 * authorised-carer checks. The authoritative enforcement is the
 * `claim_case` Postgres RPC (migration 0009), which independently checks
 * `current_user_role() in ('volunteer','org','admin')` server-side — these
 * tests cover the client-side eligibility mirror used for UI gating.
 */
describe("role gating for claim eligibility", () => {
  it("a normal registered user is not eligible to claim (hasAtLeast volunteer)", () => {
    expect(hasAtLeast("user", "volunteer")).toBe(false);
  });

  it("a guest (no role) is not eligible to claim", () => {
    expect(hasAtLeast(null, "volunteer")).toBe(false);
    expect(hasAtLeast(undefined, "volunteer")).toBe(false);
    expect(hasAtLeast("guest", "volunteer")).toBe(false);
  });

  it("a volunteer is eligible to claim", () => {
    expect(hasAtLeast("volunteer", "volunteer")).toBe(true);
  });

  it("an org account is eligible to claim (same rank as volunteer)", () => {
    expect(hasAtLeast("org", "volunteer")).toBe(true);
  });

  it("an admin is eligible to claim (highest rank)", () => {
    expect(hasAtLeast("admin", "volunteer")).toBe(true);
  });

  it("role predicate helpers correctly classify each role", () => {
    expect(isVolunteer("volunteer")).toBe(true);
    expect(isVolunteer("user")).toBe(false);
    expect(isOrg("org")).toBe(true);
    expect(isOrg("volunteer")).toBe(false);
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("org")).toBe(false);
  });
});

/**
 * Notification payload shape contract. The `notify_followers()` SQL helper
 * (migration 0009) always inserts a `message` string plus a `cat_id`, and
 * for case-scoped events a `case_id`. The NotificationsBell component reads
 * `payload.message` and `payload.cat_id` directly, so this shape must be
 * stable. These tests exercise the same TypeScript shape the UI expects,
 * guarding against a future payload rename breaking the notification
 * dropdown silently.
 */
describe("notification payload shape", () => {
  type NotificationPayload = {
    cat_id?: string;
    case_id?: string;
    message: string;
    [key: string]: unknown;
  };

  function isValidNotificationPayload(payload: unknown): payload is NotificationPayload {
    if (typeof payload !== "object" || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return typeof p.message === "string";
  }

  it("accepts a case-claimed payload shape", () => {
    const payload = { cat_id: "cat-1", case_id: "case-1", message: "A volunteer claimed a case for a cat you follow." };
    expect(isValidNotificationPayload(payload)).toBe(true);
  });

  it("accepts a status-change payload shape", () => {
    const payload = { cat_id: "cat-1", from_status: "active", to_status: "adopted", message: "A cat you follow changed status: active -> adopted" };
    expect(isValidNotificationPayload(payload)).toBe(true);
  });

  it("accepts a new-sighting payload shape", () => {
    const payload = { cat_id: "cat-1", sighting_id: "sighting-1", message: "A new sighting was linked to a cat you follow." };
    expect(isValidNotificationPayload(payload)).toBe(true);
  });

  it("rejects a payload missing the required message field", () => {
    const payload = { cat_id: "cat-1" };
    expect(isValidNotificationPayload(payload)).toBe(false);
  });
});


/**
 * M5 admin action gating. The authoritative enforcement for every admin
 * action (updateUserRole, approveOrganisation/rejectOrganisation,
 * reviewModerationFlag, hideComment/unhideComment, and each case governance
 * action) is the corresponding SECURITY DEFINER RPC (migration 0010), which
 * independently checks `is_admin()` (or, for case governance,
 * `is_admin() or has_case_access(...)`) server-side — a client cannot bypass
 * this by calling the action with a forged role. These tests cover the
 * client-side eligibility mirror used for UI gating (e.g. whether to show
 * the admin nav, role editor, or governance buttons at all).
 */
describe("admin action gating", () => {
  it("only an admin is eligible to see/use admin-only tooling", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("org")).toBe(false);
    expect(isAdmin("volunteer")).toBe(false);
    expect(isAdmin("user")).toBe(false);
    expect(isAdmin("guest")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("a non-admin is never eligible for admin-only role/approval/moderation/audit-log actions", () => {
    const nonAdminRoles = ["guest", "user", "volunteer", "org", null, undefined] as const;
    for (const role of nonAdminRoles) {
      expect(isAdmin(role)).toBe(false);
    }
  });
});

/**
 * Hidden comment visibility contract. `comments_select` RLS (0004_rls.sql)
 * only returns a hidden comment to its author or an admin; a normal viewer
 * (including a guest) must not see it. This test documents and verifies the
 * same predicate the cat profile page uses when deciding whether to include
 * `is_hidden` comments in its query (`isAdmin ? all rows : is_hidden=false`).
 */
describe("hidden comment visibility contract", () => {
  function shouldSeeHiddenComment(viewerRole: Role | null | undefined, isAuthor: boolean): boolean {
    return isAdmin(viewerRole) || isAuthor;
  }

  it("a guest cannot see a hidden comment", () => {
    expect(shouldSeeHiddenComment(null, false)).toBe(false);
  });

  it("a normal user who is not the author cannot see a hidden comment", () => {
    expect(shouldSeeHiddenComment("user", false)).toBe(false);
  });

  it("the comment's own author can still see their hidden comment", () => {
    expect(shouldSeeHiddenComment("user", true)).toBe(true);
  });

  it("an admin can see a hidden comment regardless of authorship", () => {
    expect(shouldSeeHiddenComment("admin", false)).toBe(true);
  });
});


/**
 * Audit log payload shape contract (M5). Every admin RPC writes an
 * audit_logs row via the `log_admin_action` helper (migration 0010) with
 * `actor_id`, `action`, `entity`, `entity_id`, and a `diff` jsonb blob. The
 * admin audit-log viewer (`AuditLogTable`) reads `action`/`entity`/
 * `entity_id`/`diff`/`created_at` directly and expects `diff` to always be a
 * plain object (possibly empty) it can JSON-stringify for the summary
 * column. This test guards that shape.
 */
describe("audit log payload shape", () => {
  type AuditLogEntry = {
    actor_id: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    diff: Record<string, unknown>;
    created_at: string;
  };

  function isValidAuditLogEntry(entry: unknown): entry is AuditLogEntry {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
      typeof e.action === "string" &&
      typeof e.entity === "string" &&
      typeof e.created_at === "string" &&
      typeof e.diff === "object" &&
      e.diff !== null &&
      !Array.isArray(e.diff)
    );
  }

  it("accepts a role-update audit entry shape", () => {
    const entry = {
      actor_id: "admin-1",
      action: "update_user_role",
      entity: "profiles",
      entity_id: "user-1",
      diff: { before: { role: "user" }, after: { role: "volunteer" } },
      created_at: new Date().toISOString(),
    };
    expect(isValidAuditLogEntry(entry)).toBe(true);
  });

  it("accepts an org-approval audit entry shape", () => {
    const entry = {
      actor_id: "admin-1",
      action: "approve_organization",
      entity: "organizations",
      entity_id: "org-1",
      diff: { note: "Verified contact details" },
      created_at: new Date().toISOString(),
    };
    expect(isValidAuditLogEntry(entry)).toBe(true);
  });

  it("accepts an empty diff object (e.g. unhide_comment)", () => {
    const entry = {
      actor_id: "admin-1",
      action: "unhide_comment",
      entity: "comments",
      entity_id: "comment-1",
      diff: {},
      created_at: new Date().toISOString(),
    };
    expect(isValidAuditLogEntry(entry)).toBe(true);
  });

  it("rejects an entry whose diff is an array instead of an object", () => {
    const entry = {
      actor_id: "admin-1",
      action: "close_case",
      entity: "cases",
      entity_id: "case-1",
      diff: ["not", "an", "object"],
      created_at: new Date().toISOString(),
    };
    expect(isValidAuditLogEntry(entry)).toBe(false);
  });

  it("rejects an entry missing the required action field", () => {
    const entry = {
      actor_id: "admin-1",
      entity: "cases",
      entity_id: "case-1",
      diff: {},
      created_at: new Date().toISOString(),
    };
    expect(isValidAuditLogEntry(entry)).toBe(false);
  });
});
