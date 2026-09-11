# kpick3 — NFL Pick'em Pool

A private NFL pick'em pool: every week each player picks **3 games against the spread**.
1 point per win, +1 bonus for a 3-for-3 parlay. A push (landing exactly on the number)
scores 0 and kills the parlay.

The site also runs a separate **survivor pool** (see below) — most players are in both,
but each pool has its own per-season enrollment.

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
  week, keeps lines fresh until each game's line lock, and pins the season year so the
  offseason doesn't serve last year's schedule.
- **Lines lock at fixed times.** A game's line freezes at **1 PM ET the day before
  the game** — **Saturday 1 PM ET** for Sunday/Monday games. Every pick on a game is
  graded on its **locked line** no matter when it was submitted: picks made earlier
  ride the current line until lock (the UI warns you to check back before kickoff).
  Picks can still be made or **removed until kickoff** (server-validated).
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
- **Standings** show season totals by default; the chip row switches to any single week
  (players without picks that week sink to the bottom), and a player × week points grid
  sits below with parlay stars. While a game is live, All Picks and My Picks show where a
  pick stands against its locked line (COVERING / NOT COVERING / ON THE NUMBER) — display
  only, grading still waits for the final.
- **Times** display in US Eastern.
- **Email**: reminders, weekly recaps and admin alerts go out via Resend, riding the
  sync cron. Players choose which emails they get on `/settings` (linked from the
  avatar menu); the unsubscribe link in any email turns both off at once, and the
  admin can flip either preference per player in `/admin`.
- **Profile**: players change their own display name and sign-in email on `/settings`.
  An email change re-issues the session cookie on that device and signs out any
  others. If the super admin changes their email, update `ADMIN_EMAIL` to match
  before the next `npm run seed`, or the seed will create a second admin account.
- **Removing a player**: `/admin` can delete a non-admin player outright, taking all
  their Pick 3 and survivor picks with them (standings recompute from what's left).
  Admins can't be removed from the UI, and you can't remove yourself.
- **Pick status**: `/admin` lists every player's Pick 3 count and survivor status for the
  current week, incomplete players first, so the commissioner can nudge before Saturday.
- **Last seen**: `/admin` shows when each player last loaded a page while signed in,
  refreshed at most every 15 minutes (a session cookie lasts all season, so a login
  timestamp alone would go stale).

## Scoring

| Result | Points |
| --- | --- |
| Correct pick (covers the locked spread) | 1 |
| All 3 picks correct | +1 parlay bonus (4 total) |
| Push / void / loss | 0 (a push or void also kills the parlay) |

## Survivor pool

Classic sudden-death survivor on `/survivor`, sharing the same games, sync and login:

- Each week every enrolled player picks **one team to win straight-up** (no spread).
  Lose once — including a **tie**, or a week with **no pick** — and you're out. Each
  franchise can be used **once per season** (enforced by the DB).
- **Same lock rules as pick3**: the pick locks at *that game's* kickoff, can be changed
  or removed until then, and stays hidden from other players until kickoff.
- A **canceled game voids** the pick: the player survives and the team doesn't count as
  used (the week can even be re-picked if games remain).
- The pool ends when one player remains; if everyone left loses in the same week they're
  **co-champions**. Elimination and champion status are **derived from graded picks** —
  nothing stored that can drift stale (champions are only declared once a week is fully
  graded, so a Thursday loss can't crown someone prematurely).
- Eliminated players keep full view access; the grid on `/survivor` shows everyone's
  season. The pick3 homepage shows a **banner** for enrolled players who haven't picked
  yet, escalating as kickoffs pass.
- Admin enrolls players per season in `/admin`; grading rides the same cron sync
  (straight-up, so no spread needed) and the same needs-review flow.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (Neon), `SESSION_SECRET`,
   `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PIN`. Optional: `RESEND_API_KEY` + `EMAIL_FROM`
   enable outbound email (reminders, recaps, admin alerts); leave them unset and all
   sends are logged no-ops.
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
   `ADMIN_EMAIL`, `ADMIN_PIN`, `RESEND_API_KEY`, `EMAIL_FROM` — create a free
   [Resend](https://resend.com) account, verify `kpick3.com` (DNS records at the
   registrar), and mint an API key.
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
([cron-job.org](https://cron-job.org)) **hourly at :55** — hourly is enough now that
lines freeze at fixed lock times, and :55 puts the last pre-lock sync at 12:55 PM ET
so the locked number is minutes-fresh. If the job stops running, the site keeps
serving the most recently fetched lines and the admin sees a warning banner once the
last sync is more than 75 minutes old.

```
GET https://kpick3.com/api/cron/sync
Authorization: Bearer <CRON_SECRET>
```

Manual trigger: same URL with the header (or `?secret=<CRON_SECRET>`), or the
**Run sync now** button in `/admin`. Returns
`{ ok, synced, gradedGames, flagged, voided, notified }`.

Pick deadlines do **not** depend on the cron (kickoff is checked at submission time);
the cron keeps lines fresh, pulls scores, and grades finished games.

The same cron pass also sends email: pick reminders (Sat + Sun from 9 AM ET to
anyone missing picks), a weekly recap once every game of a week is graded, and a
needs-review alert to the admin. Sends are deduped in the `notifications` table, so
hourly re-runs never double-send. **Turn on cron-job.org's "notify on failure"
setting** — a dead cron can't email you about itself, so the scheduler's own
failure alert (plus the `/admin` stale banner) covers that case.

## Security notes

- **Trust-based login**: a player's email is both identity and credential — fine for a
  private friend group, not for strangers. The upgrade path is magic-link email.
- **`SESSION_SECRET` is critical**: session cookies are `HMAC(email, SESSION_SECRET)`;
  anyone holding the secret can forge any session. The admin PIN (scrypt-hashed) is a
  second factor for the admin *login path*, but a forged cookie bypasses it — protect
  the secret. Rotating it signs everyone out.
- **`CRON_SECRET` is low-privilege**: it only authorizes the idempotent ESPN sync.
