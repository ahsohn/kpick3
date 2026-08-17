# Line Lock at Fixed Times — Design

**Date:** 2026-08-16
**Status:** Approved pending user review

## Problem

Today spreads lock per-pick at submission time: whatever the line is when you submit
is stamped on your pick (`picks.locked_spread`) and graded forever. Two players
picking the same game hours apart can be graded on different numbers.

Change: every game gets one official **locked line** at a fixed time, and every pick
on that game — whenever it was made — is graded on it.

## The rule

Each game has a **line-lock time**, computed from its kickoff in US Eastern:

- Kickoff on **Sunday or Monday** (ET) → locks the **Saturday before at 1:00 PM ET**.
- Any other day (Thu/Fri/Sat/…) → locks at **1:00 PM ET the day before** the game.

Until lock, the ESPN sync keeps the line fresh. After lock, the sync stops updating
that game's `home_spread` / `spread_details` — the number is frozen.

- **Edge:** if ESPN has no line yet at lock time, the first line to appear afterward
  is taken and then frozen (so the game still becomes pickable).
- **Pick deadline is unchanged:** picks can still be made/removed until kickoff.
  Only the line freezes early.
- Survivor pool is unaffected (straight-up, no spreads).

## Everyone grades on the locked line

`picks.locked_spread` stays, but its meaning shifts from "line at submission" to
"official line":

- On every sync pass, pending picks on **not-yet-locked** games are re-stamped to
  the current line (`spreadForSide(game.home_spread, side)`).
- Once the game's line freezes, no further re-stamps happen (nothing changes to
  re-stamp from), so all picks — early or late — sit on the same locked number.
- Picks submitted after lock stamp the frozen number as they do today.
- Grading, display, and standings code are untouched: `locked_spread` always ends
  up equal to the locked line.

Invariant: both `games.home_spread` and `picks.locked_spread` only ever change via
the sync (or pick submission, which copies from the game row), so they cannot drift
apart after lock.

## Early-picker warning

Wherever a pick or pickable game shows a **not-yet-locked** line (pick board on the
homepage, My Picks pending cards), show a notice with the actual lock time, e.g.:

> Line locks Sat 1:00 PM ET — your pick is graded on the locked line, not this one.
> Check back before kickoff in case it moves.

After lock the notice disappears (the number is final). Copy elsewhere is updated
to match ("spreads lock when you submit" on My Picks, README's "Spreads lock at
pick time" section, schema comments).

## Cron cadence: hourly

With lines frozen at fixed times, 10–15-minute syncs are unnecessary. The external
cron (cron-job.org — Vercel Hobby only allows daily) runs **hourly**, scheduled at
**:55** so the last pre-lock sync lands at 12:55 PM ET — the locked line is the
number as of minutes before the deadline, not noon.

The locked line is by construction "the last line synced before lock time." The
admin **Run sync now** button remains as a manual backstop.

## Stale-sync warning (admin only)

If the cron stops running, the app keeps serving the most recent lines fetched —
but the super admin (Alex) should know:

- **Detection:** the sync stamps `updated_at` on every upserted game, so
  `max(games.updated_at)` is the time of the last successful sync. No new table.
- **Threshold:** older than **75 minutes** (one missed hourly run plus slack).
- **Display:** a banner rendered in the shared `Shell`, visible **only to admin
  users**, on every page:
  > ⚠ Line sync last succeeded 3h ago — falling back to the most recent lines
  > fetched. Check the cron job.
- Players never see it. Before the first sync of a season (no games), no banner.

## Implementation shape

| Piece | Where |
| --- | --- |
| `lineLockTime(kickoff): Date` — pure, ET/DST-aware | `lib/picks/line-lock.ts` (new) |
| Freeze guard in game upsert + pick re-stamp step | `lib/espn/sync.ts` |
| Lock-time notice | `components/PickBoard.tsx`, `app/my-picks/page.tsx` |
| Admin stale-sync banner + `max(updated_at)` query | `components/Shell.tsx`, `lib/picks/queries.ts` |
| Copy updates | README, schema comments |
| Tests: `lineLockTime` (Sun/Mon → prior Sat 1 PM ET; Thu → Wed; Sat → Fri; DST boundaries), freeze-decision logic as a pure function | `tests/line-lock.test.ts` (new) |

No schema migration. ET math uses the same `Intl`/`America/New_York` approach as
`lib/format.ts`, so DST is handled by the platform, not hand-rolled offsets.

## Out of scope

- Changing pick deadlines (still kickoff).
- Survivor pool changes.
- Retroactive re-stamping of already-graded picks.
- Multi-season history UI (noted separately: My Picks / All Picks show the current
  season; data for past seasons stays in the DB).
