# PawPin 🐾

PawPin is a community-driven web application for reporting, tracking, and coordinating care for stray and lost cats. Built for the **#hackthekitty** hackathon, PawPin focuses on fast reporting, privacy-first mapping, and collaboration between everyday users, volunteers, rescue organizations, and admins.

## 🚀 The Pitch

Stray and lost cat sightings are often scattered across chats, social media posts, and informal community groups. PawPin centralizes those reports into one map-based workflow so sightings can become persistent cat profiles, coordinated care cases, feeding/TNR updates, and adoption progress.

Our core philosophy is **Privacy-First Collaboration**. Public users see approximate/fuzzy locations to reduce the risk of misuse, while approved volunteers, rescue organizations, and admins can access more sensitive case details when needed for rescue work.

## ✨ Key Features

- **Secure Authentication & Roles**: Supabase Auth with role-gated access for users, volunteers, rescue organizations, and platform admins.
- **Row-Level Security (RLS)**: Strict Supabase RLS policies protect user activity, private case data, and sensitive fields.
- **Privacy-Preserving Map**: Interactive Leaflet/OpenStreetMap map with public fuzzy locations. Precise coordinates are restricted to authorized workflows.
- **AI-Assisted Reporting**: Optional Gemini API integration suggests editable cat traits such as coat colour and fur pattern from uploaded photos. This is a suggestion tool, not biometric cat identification.
- **Smart Matching Engine**: Deterministic scoring suggests possible duplicate sightings based on traits, distance, recency, and case context. Human confirmation is always required.
- **Persistent Cat Profiles**: Repeat sightings can be linked into one ongoing cat history instead of becoming isolated duplicate reports.
- **Volunteer & Rescue Workflows**: Case claiming, feeding logs, TNR tracking, adoption status, comments, follows, bookmarks, and notifications.
- **Admin Governance**: User approval, organization approval, moderation flags, case governance, hidden comments, and audit logs.
- **Profile Activity Dashboard**: Users can review followed cats, bookmarked cats, reported sightings, and notifications.
- **Security Hardening**: Rate limiting, image validation, metadata stripping, security headers, and audit logging.
- **Tested Build**: TypeScript, linting, production build, and Vitest test suite.

## 🛠 Tech Stack

- **Frontend**: Next.js 14 App Router, React, TypeScript, Tailwind CSS, Leaflet / React Leaflet
- **Backend**: Supabase PostgreSQL, Supabase Auth, Supabase Storage, Row-Level Security
- **AI**: Optional Google Gemini API for image-based trait suggestions
- **Testing**: Vitest
- **Deployment**: Vercel-ready

## 📦 Supabase Setup & Migrations

PawPin uses Supabase for authentication, database, storage, and Row-Level Security policies.

Migration files are located in:

```text
supabase/migrations/
```

Run them in order:

```text
0001_extensions.sql
0002_tables.sql
0003_rls_policies.sql
0004_functions_rpc.sql
0005_storage.sql
0006_report_flow.sql
0007_matching.sql
0008_matching_rpcs.sql
0009_coordination.sql
0010_admin_governance.sql
```

For a hosted Supabase project, run the migrations through the Supabase SQL Editor or a linked Supabase CLI workflow.

## ⚙️ Environment Variables

Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=
```

`GEMINI_API_KEY` is optional. PawPin works without it. When the key is missing, the AI suggestion feature gracefully disables and users can still report cats manually.

Never commit `.env.local`.

## 🧪 Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## 🔐 Security & Privacy

PawPin implements:

- Public fuzzy location display
- Restricted precise coordinates
- Supabase Row-Level Security
- Role-gated volunteer, rescue organization, and admin workflows
- Server-only service role usage
- Image validation and metadata stripping
- Rate limiting for sensitive actions
- Security headers / Content Security Policy
- Admin audit logs
- Human confirmation for matching decisions

See:

```text
docs/security-report.md
```

for the full security breakdown.

## 🤖 AI Integration

PawPin optionally uses the Gemini API during the reporting flow to suggest cat traits from an uploaded photo.

The AI can suggest traits such as:

- coat colour
- fur pattern
- approximate size
- age group
- visible injuries
- possible pregnancy indicators
- distinguishing marks

These suggestions are editable and must be reviewed by the user before submission.

The AI does **not** identify individual cats. PawPin uses a separate deterministic matching engine to suggest possible duplicate sightings, and humans always confirm whether sightings should be linked.

## 🧭 Core User Flow

1. A user reports a stray or lost cat with a photo, traits, urgency, and location.
2. PawPin stores the report and protects sensitive location data.
3. The smart matching engine checks for possible existing cat profiles.
4. The user confirms whether the sighting should link to an existing cat or create a new profile.
5. Volunteers and rescue organizations coordinate care through cases, feeding logs, TNR status, and adoption tracking.
6. Admins manage moderation, approvals, case governance, and audit logs.

## 👥 Roles

PawPin supports four main role types:

- **User**: Reports cats, follows cat profiles, bookmarks cats, comments, and receives notifications.
- **Volunteer**: Can claim cases and contribute feeding/care updates after approval.
- **Rescue Organization**: Can coordinate TNR, adoption, and rescue workflows after approval.
- **Admin**: Manages approvals, moderation flags, hidden comments, case governance, and audit logs.

## 🗺 Location Privacy

Public users see approximate/fuzzy map locations instead of exact GPS coordinates.

This reduces risk to vulnerable cats while still giving the community enough information to understand local stray/lost cat activity.

Precise coordinates are restricted to authorized workflows for approved rescue-related roles and admin operations.

## ✅ Testing

Run all checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Current verified status:

```text
Typecheck: passed
Lint: passed
Tests: 116 passing tests
Build: passed
```

## 🎬 Demo & Submission Docs

Useful documentation:

```text
docs/architecture.md
docs/security-report.md
docs/testing.md
docs/demo-script.md
docs/submission-checklist.md
docs/kiro-writeup.md
docs/submission-description.md
```

## 🧾 Demo Accounts

Demo accounts are documented in:

```text
docs/testing.md
```

Typical seeded accounts:

```text
user@pawpin.test
volunteer@pawpin.test
org@pawpin.test
admin@pawpin.test
```

Password:

```text
PawPinDemo123
```

## 🧠 Smart Matching Engine

PawPin’s matching engine suggests possible duplicate sightings using a deterministic scoring system based on:

- coat colour
- fur pattern
- size
- age group
- distinguishing marks
- distance
- recency
- condition tags

The system only shows **possible matches**. It never claims certainty. A human must confirm whether sightings should be linked.

## 🚑 Care Coordination Features

PawPin supports a full stray cat case lifecycle:

```text
Spotted
Being Fed
Medical Attention
TNR Scheduled
Recovering
Available for Adoption
Adopted
Case Closed
Archived
```

Volunteers and organizations can coordinate:

- case claiming
- case updates
- feeding schedules
- feeding logs
- TNR records
- adoption records
- comments
- follows
- bookmarks
- notifications

## 🛡 Admin Governance

Admins can manage:

- user role approval
- rescue organization approval
- moderation flags
- hidden comments
- case closure/reopen/archive actions
- claim release/reassignment
- audit logs

This helps keep community data trustworthy and reduces abuse.

## ⚠️ Known Limitations

- AI Vision is optional and only suggests visible traits. It is not biometric cat recognition.
- Realtime dashboard updates require refresh in this version.
- Fuzzy location protects cats, but public users cannot see exact rescue coordinates.
- WebP metadata stripping is partial compared to JPEG/PNG metadata handling.
- Profile activity pages are read-only and focused on review, not full management.

## 🌱 Future Improvements

- Realtime case updates with Supabase subscriptions
- More advanced AI-assisted trait extraction
- Volunteer availability scheduling
- Donation and supply request workflows
- Vet/clinic integration
- Offline-first reporting
- QR-based cat colony signage
- Advanced search and filtering
- Better analytics for rescue organizations

## ❤️ Built For #hackthekitty

PawPin was built for the **#hackthekitty** hackathon to support cats, cat owners, volunteers, and rescue communities through safer reporting, better coordination, and privacy-first technology.
