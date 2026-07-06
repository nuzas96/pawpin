# PawPin 🐾

**PawPin** is a community-driven web application for reporting, tracking, and reuniting stray and lost cats. Built for the #hackthekitty hackathon, PawPin prioritizes speed, privacy, and community collaboration.

## 🚀 The Pitch
Stray and lost cats often go unnoticed because there isn't a centralized, localized system to report them safely. PawPin solves this by allowing everyday citizens, volunteers, and rescue organizations to collaborate on a unified platform. 

Our core philosophy is **Privacy-First Collaboration**. We use fuzzy geolocation (rounding coordinates to ~1.1km) to protect cats from malicious actors while still providing enough localized data for organizations to mount rescue operations. 

## ✨ Key Features
- **Secure Authentication & Roles**: Powered by Supabase. Three distinct tiers (User, Volunteer, Organization Admin) with strict Role-Level Security (RLS).
- **Privacy-Preserving Map**: Interactive Leaflet map displaying fuzzy locations. Exact coordinates are never sent to the client unless the user has an elevated role.
- **AI-Assisted Reporting**: (Optional) Integrated with Google's Gemini Vision API to automatically suggest coat colors and fur patterns from uploaded cat photos, improving database consistency.
- **Smart Matching Engine**: A robust scoring system that matches new lost cat reports with existing sighting reports based on distance, time, and physical traits.
- **Robust Activity Tracking**: Users can follow cats, bookmark cases, and receive notifications via a clean, scalable tabbed profile page.
- **End-to-End Type Safety**: Built on Next.js 14 App Router, TypeScript, and Vitest.

## 🛠 Tech Stack
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui components, Leaflet (React-Leaflet)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **AI / ML**: Google Gemini 1.5 Flash (Vision)
- **Testing**: Vitest (116 passing tests!)
- **Deployment**: Vercel (Ready)

## 📦 Supabase Setup & Migrations
PawPin relies on a deeply integrated Supabase backend. The database schema is built incrementally through 10 migration files (`0001` through `0010`) located in the `supabase/migrations/` directory.

To run the project locally:
1. `cp .env.example .env.local`
2. Spin up Supabase: `npx supabase start`
3. The migrations will automatically run, creating the `cats`, `sightings`, `follows`, `bookmarks`, and `notifications` tables, along with all RLS policies.
4. Run the development server: `npm run dev`

## 🔐 Security & Privacy
We take security seriously. PawPin implements:
1. **Fuzzy Location**: Public users see coordinates truncated to 2 decimal places.
2. **Row-Level Security (RLS)**: Users can only mutate their own data.
3. **Role Gating**: Volunteers and Orgs must be explicitly approved by an Admin before gaining access to precise locations and contact info.

See [`docs/security-report.md`](./docs/security-report.md) for a full breakdown.

## 🤖 AI Integration
PawPin uses Gemini 1.5 Flash to process cat images during the reporting flow. It suggests traits like `coat_color` and `fur_pattern`. We intentionally keep this as a *suggestion* tool rather than a strict biometric identifier to avoid false positives and maintain human-in-the-loop verification.

## 📝 Demo & Testing
We have included a full suite of automated tests (`npm run test`).
To test the application manually, you can use the seed accounts defined in our testing documentation.

---
*Built with ❤️ for #hackthekitty*
