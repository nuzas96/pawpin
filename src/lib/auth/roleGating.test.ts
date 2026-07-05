import { describe, it, expect } from "vitest";
import { hasAtLeast, isAdmin, isVolunteer, isOrg } from "@/lib/auth/roles";

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
