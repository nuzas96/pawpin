/** @type {import('next').NextConfig} */

// Content Security Policy tuned for PawPin's actual runtime dependencies:
// - Next.js requires 'unsafe-inline' for its injected styles, and
//   'unsafe-eval' in development for React Refresh (dropped in production).
// - Leaflet injects inline styles and loads marker icons from unpkg.
// - OpenStreetMap tile servers (*.tile.openstreetmap.org) serve map images.
// - Supabase serves Storage images and the REST/Auth API over https.
// img-src / connect-src use `https:` so the env-driven Supabase host and the
// OSM/unpkg hosts all work without hardcoding a project URL; this is a
// deliberate, documented tradeoff (see docs/security-report.md).
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is used by the report flow (same-origin only); camera and
  // microphone are not used (the photo input uses a plain file picker), so
  // they are disabled outright.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow Supabase Storage public URLs for cat photos (host is env-driven at runtime).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
