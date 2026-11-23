# Countryfloor

ACDA country dance judging for landscape tablets. Roles: **ADMIN**, **JUDGE**, **SCRUTINEER**.

Stack: **Next.js** on **Firebase App Hosting**, **Firebase Auth** (session cookies + custom claims), **Cloud Firestore** (denormalized heats / judge sheets / live board / cached results).

## Why this data model stays cheap

- Judge submit = ~3 writes (sheet + heat confirm + session `live` doc).
- Scrutineer listens to **two docs** (`sessions/.../meta/live` and `divisions/.../meta/results`), not every score.
- No SSE → full `router.refresh()` loops.
- A weekend with ~150 heats and a dozen tablets stays in the **low thousands** of reads, not hundreds of thousands.

## Setup

```bash
npm install
copy .env.example .env
# fill NEXT_PUBLIC_FIREBASE_* from Firebase console (Project settings)
```

### Local with emulators

```bash
npx firebase emulators:start --only auth,firestore
```

In another terminal (PowerShell):

```powershell
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATORS="true"
$env:NEXT_PUBLIC_FIREBASE_API_KEY="demo-api-key"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID="thecountryfloor"
npm run seed
npm run dev
```

### Sample logins

Password: `demo12`

- `admin`
- `scrutineer`
- Judges: `d.appel`, `k.linkous`, `s.hansen`, `c.graber`, `r.champion`

## Production (App Hosting)

1. Enable **Authentication** (Email/Password) and **Firestore** in project `thecountryfloor`.
2. Deploy rules: `npx firebase deploy --only firestore:rules`
3. Set App Hosting env vars from `.env.example` (API key, app id, etc.).
4. Seed once against the live project with a service account (`GOOGLE_APPLICATION_CREDENTIALS`) then `npm run seed`.
5. Push to GitHub; App Hosting builds with `npm run build` (no Prisma).

## CDD

Import `countryfloor.cdd.v1` from Admin → Import CDD JSON. Structure only; confirmed judge sheets are preserved.

## Tests

```bash
npm test
```
