import { describe, it, expect } from "vitest";
import { getSafeRedirectPath } from "./redirect";

describe("getSafeRedirectPath", () => {
  it("allows clean internal relative paths", () => {
    expect(getSafeRedirectPath("/map")).toBe("/map");
    expect(getSafeRedirectPath("/profile?tab=activity")).toBe("/profile?tab=activity");
    expect(getSafeRedirectPath("/")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBe("/profile");
    expect(getSafeRedirectPath("http://evil.com/map")).toBe("/profile");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/profile");
    expect(getSafeRedirectPath("///evil.com")).toBe("/profile");
  });

  it("rejects paths starting with backslashes or mixed slashes", () => {
    expect(getSafeRedirectPath("/\\evil.com")).toBe("/profile");
    expect(getSafeRedirectPath("\\\\evil.com")).toBe("/profile");
    expect(getSafeRedirectPath("/test\\path")).toBe("/profile");
  });

  it("rejects non-strings and empty values", () => {
    expect(getSafeRedirectPath(null)).toBe("/profile");
    expect(getSafeRedirectPath(undefined)).toBe("/profile");
    expect(getSafeRedirectPath("")).toBe("/profile");
  });

  it("rejects control characters that could break HTTP headers", () => {
    expect(getSafeRedirectPath("/valid\n/invalid")).toBe("/profile");
    expect(getSafeRedirectPath("/valid\r/invalid")).toBe("/profile");
  });

  it("uses the provided fallback instead of /profile", () => {
    expect(getSafeRedirectPath("//evil", "/")).toBe("/");
  });
});
