# PawPin Testing Setup

PawPin ensures robust reliability using **Vitest** for automated unit and integration tests. The test suite thoroughly verifies core business logic, matching engines, and crucial privacy guards.

## Test Suite Status
✅ **123 Tests Passing** across 10 test suites.

## Areas Tested
1. **Validation & Image Metadata** (`src/lib/validation/*`)
   Ensures uploaded files meet size limits and valid file extensions, catching bad user input early. Includes strict metadata stripping tests (fail-closed) and WEBP rejection.
2. **Location Privacy** (`src/lib/map/publicMapPrivacy.test.ts` and `src/lib/geo/location.test.ts`)
   Vigorously tests that fuzzy truncation accurately outputs 2-decimal-place coordinates regardless of bounding box logic, confirming location privacy.
3. **Role Gating** (`src/lib/auth/roleGating.test.ts`)
   Verifies that users can only access endpoints authorized for their specific tier (User, Volunteer, Org, Admin) and tests the strict `is_approved` requirements.
4. **Rate Limiting** (`src/lib/rateLimit.test.ts`)
   Tests our in-memory rate limiting implementation to ensure API endpoints don't get DDoSed or spammed.
5. **Matching Engine** (`src/lib/matching/engine.test.ts` and `wordingAndPrivacy.test.ts`)
   Tests the mathematical matching logic that calculates confidence scores based on distance, time discrepancy, and matching visual traits.
6. **AI Vision Suggestions** (`src/lib/ai/vision.test.ts`, `src/actions/aiVision.test.ts`)
   Verifies the prompt generation for Gemini Vision properly isolates colors and patterns, and confirms images are sanitized before being sent.
7. **Authentication & Redirects** (`src/lib/auth/redirect.test.ts`)
   Tests the `getSafeRedirectPath` helper to prevent Open Redirect vulnerabilities.

## Running Tests Locally
To run the full test suite locally:
```bash
npm run test
```

## Seed Accounts (For Manual Testing)
If you are setting up the Supabase database and running manually, we recommend creating these accounts via the `/auth/sign-up` UI, then promoting them via the database or an admin account:
- `user@example.com` - Standard user
- `volunteer@example.com` - Volunteer (unapproved)
- `volunteer_approved@example.com` - Volunteer (approved, full map access)
- `admin@pawpin.app` - Administrator
