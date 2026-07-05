import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  RATE_LIMITS,
  RATE_LIMIT_MESSAGE,
  __resetRateLimitsForTest,
} from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimitsForTest());

  it("allows events up to the limit, then blocks", () => {
    const rule = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("test", "user-1", rule).ok).toBe(true);
    expect(checkRateLimit("test", "user-1", rule).ok).toBe(true);
    expect(checkRateLimit("test", "user-1", rule).ok).toBe(true);
    const blocked = checkRateLimit("test", "user-1", rule);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks limits per identity independently", () => {
    const rule = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("test", "user-a", rule).ok).toBe(true);
    expect(checkRateLimit("test", "user-a", rule).ok).toBe(false);
    // A different user is unaffected.
    expect(checkRateLimit("test", "user-b", rule).ok).toBe(true);
  });

  it("tracks limits per action independently", () => {
    const rule = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("action-x", "user-1", rule).ok).toBe(true);
    expect(checkRateLimit("action-x", "user-1", rule).ok).toBe(false);
    // A different action for the same user is unaffected.
    expect(checkRateLimit("action-y", "user-1", rule).ok).toBe(true);
  });

  it("reports decreasing remaining allowance", () => {
    const rule = { limit: 3, windowMs: 60_000 };
    const first = checkRateLimit("rem", "user-1", rule);
    const second = checkRateLimit("rem", "user-1", rule);
    if (first.ok && second.ok) {
      expect(first.remaining).toBe(2);
      expect(second.remaining).toBe(1);
    } else {
      throw new Error("expected both to be allowed");
    }
  });

  it("exposes sensible default rules for each sensitive action", () => {
    for (const key of ["report", "matchDecision", "comment", "flag", "ai"] as const) {
      expect(RATE_LIMITS[key].limit).toBeGreaterThan(0);
      expect(RATE_LIMITS[key].windowMs).toBeGreaterThan(0);
    }
  });

  it("has a friendly, user-facing throttle message", () => {
    expect(RATE_LIMIT_MESSAGE.toLowerCase()).toContain("too many requests");
  });
});
