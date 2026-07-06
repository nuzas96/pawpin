import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireUser } from "./guards";
import * as guardsMod from "./guards";
import { redirect } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock the getSessionUser function inside the same module
// It's tricky to mock a function in the same module if it's called internally.
// A better way is to test getSafeRedirectPath independently (which is already done in redirect.test.ts).
// But we can mock getSessionUser by spying on the module if we use a wrapper, or we can just trust the integration.
// Let's mock createClient instead.

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  })),
}));

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to a safe path", async () => {
    await requireUser("https://evil.com");
    // Should fallback to /auth/sign-in
    expect(redirect).toHaveBeenCalledWith("/auth/sign-in");
  });

  it("redirects unauthenticated users to allowed relative paths", async () => {
    await requireUser("/profile?tab=activity");
    expect(redirect).toHaveBeenCalledWith("/profile?tab=activity");
  });
});
