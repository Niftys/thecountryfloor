# Countryfloor

ACDA country dance judging for landscape tablets. Roles: **ADMIN**, **JUDGE**, **SCRUTINEER**.

Seeded competitions:

1. **LoneStar Invitational 2026** · Division III — real score-sheet sample (places 1 / 2 / 3).
2. **Prairie Demo Classic 2025** — fake contest with two divisions (Open Couples + ProAm Newcomer), two sessions (Morning / Afternoon). Heat 1 is Two Step with both divisions on the same song; incomplete heats and a scratch alert for navigation testing.
3. **Cedar Ridge Showcase 2024** — seeded **inactive** so you can test the inactive message; Admin can mark it active. Division I / II, Evening + Late Night.

A heat is one song: one dance style, any number of divisions. Floor style order: Triple Two, Nightclub, Waltz, Polka, Cha Cha, East Coast Swing, Two Step, West Coast Swing.

## Setup

Run these yourself in `D:\Desktop\Coding\countryfloor`:

```bash
npm install
npm run db:setup
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

After pulling schema changes (ScoreAudit, idempotent submit ids), always re-run `npm run db:setup`.

## Sample logins

Password for every seeded account: `demo`

- `admin`
- `scrutineer`
- Judge logins (username ≠ sheet name): `d.appel`, `k.linkous`, `s.hansen`, `c.graber`, `r.champion` — display names stay `D. APPEL`, etc.

## What ships

### Judge
- Large medals/bibs, heat arrows, dance in heat dropdown
- Medal vs place validation; places auto-fill from medal bands (ties highlighted for judge pick)
- Big confirm dialog with bib boxes
- Dirty-heat warning when leaving unsubmitted work
- Offline queue + idempotent confirm (`Saved locally / Syncing / Confirmed`)
- Per-device **Large type** and **High contrast** toggles in the header

### Scrutineer
- Live polling board + SSE refresh
- Score overrides with red cells
- Rule 9 / **Rule 10 / Rule 11** overall columns
- Override **audit log**
- Export division packet (`countryfloor.results.v1`)

### Admin
- Users CRUD, competition active/inactive
- Session judge panel assignment
- Download JSON backup
- Import `countryfloor.cdd.v1` structure for new/updated competitions (never overwrites confirmed scores)

### CDD seam
- All vendor mapping lives in `src/lib/cdd/`
- Samples and notes in `cdd-samples/`
- Drop real CDD exports there when you have them; only the adapter changes

## Live sync

Open pages stay in sync over **Server-Sent Events** (`/api/events`). Judge submits, scrutineer edits, and admin changes push to connected tablets. Default bus is in-process (one Node server). `src/lib/live.ts` is the swap point for Redis when you run multiple instances.

## Before a real weekend

- Move `DATABASE_URL` to hosted Postgres (schema is Prisma-ready; SQLite is fine for demos).
- Take an Admin **Download backup** before floor opens.
- Capture one real CDD registration + results file pair into `cdd-samples/` and map them in the adapter with tests.
