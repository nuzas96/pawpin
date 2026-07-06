# Development tooling & AI write-up

PawPin was built from the ground up using advanced AI pair-programming tools over the course of the #hackthekitty hackathon. 

## The Process
Development was guided by AI agents capable of full-stack engineering, following the strict architectural guidelines defined in the `.kiro/specs/pawpin/spec.md`.

## Key AI Involvements
1. **Database Schema & RLS**: The AI securely generated 10 migration files, ensuring that all tables (cats, sightings, feeding_schedules, etc.) were locked down using Supabase Row-Level Security (RLS) policies. It ensured that users could only access precise coordinates if their role was specifically evaluated and `is_approved = true`.
2. **Matching Engine**: The deterministic heuristic matching engine was architected by the AI. It seamlessly cross-references haversine distance metrics, exponential decay based on time, and physical characteristics.
3. **Robust UX Generation**: The frontend components (Next.js App Router, Tailwind, Server Components) were iteratively designed with the AI. The profile tab architecture is a specific highlight of server-side data fetching coupled with lightweight client interaction.
4. **Testing Suite**: The AI built the comprehensive Vitest suite comprising 116 tests, which heavily exercise the location privacy truncation and matching engine safety rails.

## Gemini Vision Integration
Outside of the development environment, PawPin utilizes Google's **Gemini 1.5 Flash Vision API** in production to assist users when reporting sightings. When a user uploads a photo, the image is streamed to Gemini, which returns a structured JSON payload suggesting the coat color and fur pattern. This drastically normalizes the user input while keeping a human-in-the-loop validation step.
