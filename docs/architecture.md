# PawPin Architecture

PawPin is built on a modern, serverless-first architecture optimized for rapid development, robust security, and seamless developer experience.

## Core Stack
- **Frontend**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend / Database**: Supabase (PostgreSQL)
- **Mapping**: Leaflet + React-Leaflet
- **AI**: Google Gemini 1.5 Flash Vision API
- **Testing**: Vitest

## System Design
The application follows a standard React/Next.js client-server model:
1. **Client Components**: Handle interactive UI elements like the Leaflet map (`PublicMap.tsx`), forms, and tab navigations.
2. **Server Components**: Handle heavy lifting for data fetching (e.g., `ProfilePage`, `CasesPage`) directly from Supabase.
3. **Supabase Server Client**: Provides secure server-side fetching with cookies automatically propagated.

## Database Schema Highlights
The database uses normalized tables linked by foreign keys and secured by RLS.
- `profiles`: Extends the Auth user with `display_name`, `role`, and `is_approved`.
- `cats`: The core entity, tracking status (stray, lost, found), coat colors, and fur patterns.
- `sightings`: Individual reports linking to a cat. Holds latitude/longitude and images.
- `follows` & `bookmarks`: Many-to-many relationship tracking user activity.
- `notifications`: Async event tracking for users.

## Component Hierarchy
- `src/app`: Next.js App Router pages (routing).
- `src/components/map`: Custom Leaflet implementations.
- `src/components/ui`: Reusable UI components from shadcn.
- `src/lib/auth`: Role-gating logic and `SessionUser` extraction.
- `src/lib/matching`: Logic for calculating matches between sightings based on distance, time, and visual traits.
- `src/lib/geo`: Fuzzy location truncation logic.

## Matching Engine
When a new sighting is created, the system can cross-reference existing records.
The matching engine (`src/lib/matching/engine.ts`) calculates a confidence score based on:
1. **Distance**: Haversine formula calculation.
2. **Time**: Difference in days since last seen.
3. **Traits**: Matching coat color and fur pattern.

## Deployment Architecture
PawPin is designed to deploy seamlessly to Vercel, with Supabase hosted remotely.
Environment variables control integration points, strictly adhering to Next.js `NEXT_PUBLIC_` prefixes only where client exposure is required (e.g., Supabase URL and Anon Key).
