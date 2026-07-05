# PawPin — Security Report

This document describes PawPin's threat model and the controls implemented in
Milestones M0/M1. Security is a layered, defense-in-depth design with Postgres
Row Level Security (RLS) as the authoritative boundary.

## 1. Threat model

| Asset | Threat | Primary control |
|---|---|---|
| Precise cat locations | De-anonymising a stray's location enables harm (poisoning, abuse, theft) | RLS + SQL coordinate fuzzing; precise coords never exposed to guests/users |
| User accounts | Privilege escalation to volunteer/org/admin | Role set server-side only; `enforce_profile_guard` trigger blocks self-escalation |
| Adopter contact info (PII) | Unauthorised access | RLS restricts `adoptions` to admins/authorised carers |
| Uploaded photos | Embedded EXIF/GPS leaks location | Server-side metadata stripping before upload (M2 upload pipeline) |
| User content | XSS via comments/notes | Stored + rendered as plain text; no `dangerouslySetInnerHTML` |
| Service role key | Full DB access if leaked to client | `server-only` import guard; never referenced in client bundles |
| Sensitive actions | Undetected abuse | Audit logging via DB triggers (insert-only, admin-read) |

## 2. Authentication

- Supabase Auth (email/password), JWT sessions stored in cookies.
- Middleware refreshes the session on each request.
- On sign-up, a Postgres trigger (`handle_new_user`) provisions a `profiles`
  row with `role = 'user'`. The client cannot choose its own role.

## 3. Authorization (RLS)

RLS is enabled on **every** table (`supabase/migrations/0004_rls.sql`). Access
is resolved through `SECURITY DEFINER` helper functions with a pinned
`search_path`:

- `current_user_role()`, `is_admin()`, `is_volunteer()`, `is_org()`
- `has_case_access(case_id)` — admin, the claiming volunteer, or an org member
- `has_cat_access(cat_id)` — same, across any of the cat's cases

Highlights:

- **profiles** — read own or admin; update own only; role/org/approval changes
  blocked for non-admins by the `enforce_profile_guard` trigger.
- **sightings (precise)** — readable only by reporter, admin, or authorised
  carers. Guests/normal users cannot select precise coordinates at all.
- **cases** — a volunteer can claim an unclaimed case; org members manage their
  org's cases; admins manage all.
- **adoptions** — restricted to admins/authorised carers (minimises PII exposure).
- **comments** — non-hidden visible to all; authors see their own; admins
  moderate (hide) via update.
- **follows/bookmarks/notifications** — strictly `user_id = auth.uid()`.
- **moderation_flags** — authenticated users file reports; only admins read/resolve.
- **audit_logs** — admin-read only; no client insert/update/delete policy, so
  rows are written exclusively by the `SECURITY DEFINER` audit trigger.

## 4. Location privacy & EXIF

- Precise coordinates live only in `sightings.lat/lng`.
- `fuzz_coordinate()` rounds to ~110m and adds stable jitter; the
  `sighting_geo_public` view exposes only fuzzed coordinates and is the only
  geo source granted to `anon`/`authenticated`.
- Because fuzzing happens in SQL and the raw columns are not selectable under
  RLS, a malicious client cannot recover precise coordinates.
- **EXIF/GPS metadata**: uploaded photos are re-encoded server-side to strip
  embedded metadata before they reach Storage (implemented with the M2 upload
  pipeline). Cameras commonly embed GPS in image EXIF; stripping it prevents a
  privacy leak that would otherwise bypass the fuzzing layer.

## 5. Input & file validation

- All inputs validated with Zod schemas (`src/lib/validation/schemas.ts`),
  shared client/server; the server re-validates and never trusts the client.
- Images: MIME allowlist (`image/jpeg|png|webp`), 8 MB max, extension check,
  and magic-byte detection (`detectImageType`) to catch spoofed types.
- Storage uploads are scoped to a `<uid>/` folder per user.

## 6. Data minimisation

- Guests can report without an account.
- Only necessary fields are collected; adopter contact is free-text, minimal,
  and access-restricted.

## 7. Secrets hygiene

- Only `.env.example` is committed; `.env.local` and all `.env*` are git-ignored.
- The service-role key is server-only, enforced by `import "server-only"`.
- Next.js was pinned to a patched 14.2.x release to avoid a known advisory.

## 8. Known gaps / planned (M6)

- Rate limiting on report/comment endpoints.
- CAPTCHA / abuse throttling for anonymous reporting.
- Automated RLS policy test suite (currently a manual per-role checklist —
  see `docs/testing.md`).
- Content Security Policy headers.
