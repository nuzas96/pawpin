/**
 * Safe redirect helper to prevent Open Redirect vulnerabilities.
 * 
 * - Ensures the path starts with exactly one slash `/`.
 * - Rejects external domains, protocol-relative URLs (`//evil.com`), and javascript/data URIs.
 * - Rejects paths starting with `/\` or `\\` (often used to bypass naive checks).
 * 
 * @param path The requested redirect path (e.g. from a search param).
 * @param fallback The fallback path if the requested path is invalid.
 * @returns A safe, internal relative path.
 */
export function getSafeRedirectPath(path: string | null | undefined, fallback = "/profile"): string {
  if (!path || typeof path !== "string") {
    return fallback;
  }

  // Must start with a single slash
  if (!path.startsWith("/")) {
    return fallback;
  }

  // Reject protocol-relative URLs (`//example.com`)
  if (path.startsWith("//")) {
    return fallback;
  }

  // Reject backslash tricks (`/\example.com`, `\\example.com`)
  if (path.startsWith("/\\") || path.includes("\\")) {
    return fallback;
  }

  // Reject encoded newlines or control characters that might break headers
  if (/[\r\n\t\0]/.test(path)) {
    return fallback;
  }

  return path;
}
