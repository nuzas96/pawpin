# PawPin Testing Guide

This document explains how PawPin was tested and how judges can verify the main app flows.

## Automated Test Status

The current test suite passes successfully:

```text
13 test files passed
129 tests passed
```

Run the full test suite with:

```bash
npm run test
```

For the final verification, the project was checked with:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

All four commands passed.

## What the Tests Cover

The automated tests focus on the most important parts of the app:

### 1. Validation and Image Safety

Tests check that uploaded images are validated before use.

This includes:

- file type validation
- file size limits
- metadata stripping
- fail-closed image handling
- WEBP rejection
- JPG and PNG support

### 2. Location Privacy

PawPin protects exact cat locations from public users.

Tests verify that public map data uses approximate/fuzzy coordinates instead of precise GPS values.

### 3. Role Access

Tests check that role-based access works as expected.

Roles include:

- user
- volunteer
- rescue organization
- admin

The tests also check approval requirements for elevated roles.

### 4. Rate Limiting

Sensitive actions are rate-limited to reduce spam and abuse.

Tested actions include reporting, comments, matching decisions, flags, and AI suggestions.

### 5. Matching Engine

The matching engine is tested separately from the UI.

Tests cover similarity scoring based on:

- cat traits
- distance
- recency
- distinguishing marks
- safe wording

PawPin only shows possible matches. Human confirmation is always required.

### 6. AI Vision Safety

AI Vision is optional.

Tests verify that:

- the app works without a Gemini API key
- malformed AI responses are rejected
- image data is sanitized before being sent to Gemini
- AI suggestions remain editable
- AI is not treated as cat identification

### 7. Authentication Redirect Safety

Tests check that auth redirects only allow safe internal paths.

External URLs, protocol-relative URLs, and malicious redirect payloads are rejected.

### 8. Storage Path Safety

Tests check that cat photo storage paths are safely generated.

The app rejects invalid uploader IDs and path traversal patterns.

## Manual Testing Accounts

Use these demo accounts for manual testing:

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

## Manual Test Flow

### User Flow

1. Sign in as `user@pawpin.test`.
2. Open `/report`.
3. Upload a cat photo.
4. Fill in cat traits, urgency, condition, notes, and location.
5. Submit the report.
6. Review possible matches.
7. Create a new cat profile or link the sighting to an existing profile.
8. Open the cat profile.
9. Follow and bookmark the cat.
10. Check `/profile` for user activity.

### Map Flow

1. Open `/map`.
2. Confirm that cat markers appear.
3. Click a marker.
4. Open the related cat profile.
5. Confirm that public map locations are approximate, not precise GPS coordinates.

### Volunteer Flow

1. Sign in as `volunteer@pawpin.test`.
2. Open `/dashboard/volunteer`.
3. Review available cases.
4. Claim a case if available.
5. Add a case update or feeding log.

### Organization Flow

1. Sign in as `org@pawpin.test`.
2. Open `/dashboard/org`.
3. Review rescue-related cases.
4. Check TNR and adoption workflow sections.

### Admin Flow

1. Sign in as `admin@pawpin.test`.
2. Open `/admin`.
3. Review users and organizations.
4. Review moderation flags.
5. Check audit logs.
6. Confirm admin-only pages are not accessible to normal users.

## Security Scan Evidence

PawPin was scanned with Aikido AI Code Audit.

Final AI Code Audit result:

```text
Open issues: 0
Solved issues: 3
Ignored issues: 0
```

The screenshot is stored at:

```text
docs/assets/aikido-ai-code-audit-clean.png
```

## Notes

- AI Vision is optional. The app still works if `GEMINI_API_KEY` is not set.
- PawPin supports JPG and PNG uploads only.
- WEBP is disabled because this version prioritizes safe metadata stripping.
- Public map data uses approximate locations to protect cats from misuse.
- Exact location handling is restricted to approved rescue workflows.