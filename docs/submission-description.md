# PawPin: Drop a Pin, Save a Stray

## 🐱 The Problem
Stray-cat sightings are heavily fragmented across scattered social media posts, neighborhood chat groups, and physical flyers. The exact same cat might be reported dozens of times by different people, but with no shared history. This fragmentation makes it nearly impossible for rescue organizations to coordinate Trap-Neuter-Return (TNR) efforts, track feeding schedules, or manage medical care.
Worse, posting exact locations publicly can expose vulnerable animals to malicious actors.

## 🌟 Our Solution
**PawPin** is a centralized, community-driven web application that turns isolated sightings into a persistent, actionable case history. 

Every sighting is cross-referenced using our **Smart Matching Engine**, which uses location, time, and physical traits to link new reports to existing cats. Our platform provides specialized, role-gated tools (for Volunteers and Orgs) to manage feeding schedules, TNR pipelines, and adoption processing—all while keeping the public map secure using **fuzzy geolocation** (truncating locations to ~1.1km).

## 🚀 Core Features
1. **Persistent Cat Profiles**: A continuous history of sightings, timeline events, and updates for a single cat.
2. **Fuzzy Location Privacy**: Exact coordinates are strictly role-gated via Supabase RLS. Public users only see a generalized radius.
3. **AI-Assisted Reporting**: Users can upload a photo of the cat, and our Gemini Vision integration will suggest coat colors and patterns to standardize data entry.
4. **Smart Matching Engine**: When a user reports a cat, the system calculates confidence scores against existing profiles and suggests matches.
5. **Rescue Dashboards**: Approved organizations and volunteers have dedicated dashboards to track claimed cases, feeding schedules, and TNR records.
6. **Robust Moderation**: Admins have powerful tools to manage user roles, approve organizations, handle flagged content, and maintain audit logs.

## 🛠 Tech Stack
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui, Leaflet Map
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Storage)
- **AI**: Google Gemini 1.5 Flash (Vision API)
- **Testing**: Vitest

PawPin is incredibly fast, thoroughly tested (116 automated tests), and fully type-safe. It’s ready to deploy and instantly start making a difference in the community.
