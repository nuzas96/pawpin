# PawPin Security & Privacy Report

PawPin manages sensitive community data and physical locations. We have designed a strict security model to prevent misuse, data leaks, and unauthorized access to precise cat locations.

## Location Privacy Model
Precise location data (e.g., coordinates) can be weaponized if exposed publicly. 
PawPin mitigates this via **Fuzzy Geolocation Truncation**:
- Coordinates stored in the database are truncated in the backend map endpoints to **2 decimal places** (approximately 1.1km precision) for all public endpoints.
- Standard users only see the fuzzy coordinates.
- **Strict Role-Gating**: Only *Approved Volunteers* and *Approved Organizations* can query the exact `lat`/`lng` of a sighting.

## Supabase Row-Level Security (RLS)
The database enforces strict RLS policies on all tables:
- **Profiles**: Users can only update their own profile data. Admin accounts can update approval statuses.
- **Sightings**: Public users can insert sightings but can only update/delete sightings they own. 
- **Cats**: Similar restrictions prevent vandalism of cat status or attributes.
- **Follows / Bookmarks / Notifications**: Private to the `user_id`. You cannot query someone else's notifications.

## Role-Gating and Approval Flow
PawPin uses a 3-tier role system:
1. `user`: Default. Can report and view public/fuzzy data.
2. `volunteer`: Elevated permissions.
3. `org`: Organization admin.
4. `admin`: System admin.

**Crucial Check**: Merely having the `volunteer` or `org` role is NOT enough. Users must have `is_approved = true`. This prevents bad actors from simply registering an "organization" account and gaining immediate access to exact coordinates.

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only exposed environment variables, which is safe due to Supabase RLS.
- Sensitive keys like `GEMINI_API_KEY` are heavily guarded, accessed only securely on the server environment.

## Audit Logs
Admin dashboards have visibility into user creations and critical system flags to monitor for abuse.
