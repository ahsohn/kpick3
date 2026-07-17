# kpick3 — NFL Pick'em Pool

A private NFL pick'em pool: every week each player picks **3 games against the spread**.
1 point per win, +1 bonus for a 3-for-3 parlay. A push (landing exactly on the number)
scores 0 and kills the parlay.

**Live:** https://kpick3.com

## Stack

Next.js (App Router, TypeScript) · Neon Postgres · Drizzle ORM · Tailwind CSS · Vercel.
(Previously a static GitHub Pages site backed by Google Sheets + Apps Script — fully
retired when DNS cut over to Vercel in July 2026.)

## How it works

- **Auth is trust-based**: enter a registered email and you're in (no password). The
  super admin additionally enters a **PIN**. Admin pre-creates players in `/admin`.
- **Games, spreads & scores** sync from ESPN's public NFL API into Postgres via
  `GET /api/cron/sync` (authorized by `CRON_SECRET`). The sync auto-detects the current
  week, keeps lines fresh until kickoff, and pins the season year so the offseason
  doesn't serve last year's schedule.
- **Spreads lock at pick time.** Submitting a pick copies the current line onto the pick
  (`picks.locked_spread`) — that's the number it's graded on, no matter how the line
  moves later. A pick can be **removed until kickoff** (server-validated); re-picking
  locks whatever the spread is at that moment.
- **Deadlines are server-enforced.** A pick is only accepted while the game's kickoff is
  in the future and its status is still `pre` — checked in the server action, not the UI.
- **Everyone's picks stay hidden until kickoff**, enforced server-side: the All Picks
  query only returns picks whose game has started; before that you just see a count.
- **Grading is automatic.** When a game goes final the cron grades every pick against
  its locked spread (win / loss / push) and standings recompute from graded picks —
  nothing is stored that can drift stale. A final with a missing/weird score is flagged
  for one-click admin confirmation in `/admin` instead of mis-grading; canceled games
  void their picks (0 points, doesn't count as a loss, but a parlay still needs 3 wins).
- **Live scores** for in-progress games are fetched straight from ESPN at render time
  (cached ~30s, shared across renders) so they're fresher than the last cron tick; if
  ESPN is unreachable pages still render from the DB. Live scores never feed grading.
- **Times** display in US Eastern.

## Scoring

| Result | Points |
| --- | --- |
| Correct pick (covers the locked spread) | 1 |
| All 3 picks correct | +1 parlay bonus (4 total) |
| Push / void / loss | 0 (a push or void also kills the parlay) |

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (Neon), `SESSION_SECRET`,
   `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PIN`.
3. `npm run db:migrate` — apply the schema to your Neon database.
4. `npm run seed` — create/refresh the super-admin user from `ADMIN_EMAIL` + `ADMIN_PIN`.
5. `npm run dev` — sign in with the admin email + PIN, add players in `/admin`, and hit
   **Run sync now** to load games.

## Tests

`npm test` — Vitest suites for ATS grading & weekly scoring, ESPN scoreboard/odds
parsing, season-year detection, session cookies, and the admin PIN hash.

## Deploy (Vercel + Neon)

1. Import this repo as a Vercel project; add the **Neon** integration (auto-sets
   `DATABASE_URL`). Auto-deploys on every push to `main`.
2. Set env vars in Vercel (Production + Preview): `SESSION_SECRET`, `CRON_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_PIN`.
3. **Migrate + seed the production DB**: copy the Neon connection string into a local
   `.env`, then `npm run db:migrate && npm run seed`.
4. Point `kpick3.com` at the project (Vercel → Domains + DNS change at your registrar).
   Remember: env-var changes in Vercel only apply to the **next** deployment — redeploy
   after adding or editing them.

## Scheduled sync (cron)

> **⚠ TBD — not set up yet (as of July 2026).** The cron-job.org job below still needs
> to be created before the season starts in September. Until then, lines and scores only
> update via the **Run sync now** button in `/admin`.

Vercel **Hobby** only allows daily crons, so schedule an external job
([cron-job.org](https://cron-job.org)) every **10–15 minutes**:

```
GET https://kpick3.com/api/cron/sync
Authorization: Bearer <CRON_SECRET>
```

Manual trigger: same URL with the header (or `?secret=<CRON_SECRET>`), or the
**Run sync now** button in `/admin`. Returns
`{ ok, synced, gradedGames, flagged, voided }`.

Pick deadlines do **not** depend on the cron (kickoff is checked at submission time);
the cron keeps lines fresh, pulls scores, and grades finished games.

## Security notes

- **Trust-based login**: a player's email is both identity and credential — fine for a
  private friend group, not for strangers. The upgrade path is magic-link email.
- **`SESSION_SECRET` is critical**: session cookies are `HMAC(email, SESSION_SECRET)`;
  anyone holding the secret can forge any session. The admin PIN (scrypt-hashed) is a
  second factor for the admin *login path*, but a forged cookie bypasses it — protect
  the secret. Rotating it signs everyone out.
- **`CRON_SECRET` is low-privilege**: it only authorizes the idempotent ESPN sync.
