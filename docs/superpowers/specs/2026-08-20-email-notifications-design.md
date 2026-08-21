# Email Notifications — Design

**Date:** 2026-08-20
**Status:** Approved design, pre-implementation

## Goal

Add three kinds of email to the site, sent via Resend:

1. **Pick reminders** — Saturday and Sunday morning emails to players still missing
   picks (pick3 and survivor).
2. **Weekly recap** — one email to everyone once a week is fully graded: week results,
   parlay outcomes, standings, survivor eliminations.
3. **Admin needs-review alert** — email the super admin the moment the cron flags a
   final for review.

Out of scope (for now): magic-link login. The sending layer and signed-token
unsubscribe route built here are exactly the infrastructure magic links need, so
nothing in this design precludes it.

Stale-sync alerting is deliberately **not** code: if the sync stops running, so does
any in-app watchdog. Use cron-job.org's built-in failure notifications (a checkbox on
the job) instead; the existing `/admin` stale banner stays as backstop.

## Provider & sending layer

- **Resend** free tier (3k emails/month, 100/day) — far above this pool's volume.
- One-time manual setup: create Resend account, verify `kpick3.com` via DNS records
  at the registrar, create an API key.
- `lib/email/send.ts`: thin wrapper that POSTs to `https://api.resend.com/emails`
  with `fetch`. **No new npm dependency.**
- New env vars (add to `.env.example`, README, and Vercel):
  - `RESEND_API_KEY` — if unset, `sendEmail()` is a logged no-op (local dev and
    tests never send).
  - `EMAIL_FROM` — e.g. `kpick3 <picks@kpick3.com>`.
- Emails are simple inline-styled HTML with a plain-text fallback. Player-facing
  emails include the unsubscribe link and a `List-Unsubscribe` header.

## Schema changes (one migration)

```ts
// users: add
emailOptOut: boolean('email_opt_out').notNull().default(false)

// new table: sent-log for idempotent sends
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),            // 'reminder' | 'recap' | 'needs_review'
  dedupeKey: text('dedupe_key').notNull(), // see below
  userId: integer('user_id').references(() => users.id), // null for admin alerts
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byDedupe: uniqueIndex('notifications_dedupe_uq').on(t.dedupeKey),
}))
```

Dedupe keys:

- Reminders: `reminder:<pool>:<sat|sun>:<season>:w<week>:u<userId>`
  (pool = `pick3` | `survivor`)
- Recap: `recap:<season>:w<week>:u<userId>`
- Needs-review: `needs_review:g<gameId>`

The unique index is the idempotency gate: claim the key (insert) before sending; a
conflict means already sent. If a send fails after the claim, delete the claim so the
next hourly tick retries. This matches the repo's "derive, don't store driftable
state" rule — the table records only facts about sends.

## Trigger architecture

No new cron job or secret. `GET /api/cron/sync` runs `runNotifyPass()` after
`runSyncPass()` (failures in notify must not fail the sync response — wrap and report
in the JSON payload, e.g. `{ ..., notified: { reminders, recaps, adminAlerts } }`).

`lib/notify/pass.ts` (new) runs three checks per tick:

### Pick reminders (Sat + Sun mornings)

- **Windows** (computed with the ET helpers in `lib/picks/line-lock.ts` —
  export `etParts`/`etWallTimeToUtc` or add a sibling helper):
  - Saturday: Sat 9:00 AM ET → Sat 11:59 PM ET (before the 1 PM ET line lock, so
    players can act on near-final lines).
  - Sunday: Sun 9:00 AM ET → Sun 11:59 PM ET.
  - The hourly cron at :55 means sends land ~9:55 AM ET.
- **Eligibility, pick3**: user has fewer than 3 picks this week AND at least one
  game with `statusState = 'pre'` and future kickoff remains this week. Email says
  how many picks they have (0/1/2) and when the next kickoffs are.
- **Eligibility, survivor**: enrolled this season, still alive (derived via
  `lib/survivor/logic.ts`), no non-void pick this week, and at least one usable game
  remains.
- One email per player per window covering both pools (a player missing both gets a
  single combined email; the dedupe key is claimed per pool, both attached to the
  same send).
- Skips `emailOptOut` users.

### Weekly recap

- Targets the **current and previous** week (the sync's auto-detected week rolls
  forward around Tuesday, which is exactly when the finished week's recap becomes
  due — keying on "current week" alone would skip it; bounding to these two weeks
  also stops a mid-season deploy from backfilling old recaps).
- Fires for a target week once it is **fully graded**: every non-canceled game of
  (season, week) has `completed = true`, `gradedAt` set, and `needsReview = false`.
  A flagged game therefore holds the recap until the admin confirms it — correct,
  since grading isn't final until then. Typically lands Tuesday morning after MNF.
- Sent to every user (minus opt-outs), personalized: your 3 picks with results,
  week points, parlay hit/miss, current season standings (top plus your row),
  survivor: who was eliminated this week / champion if decided.
- Recap data comes from the existing derivation queries
  (`lib/picks/queries.ts`, `lib/survivor/queries.ts`) — no new stored aggregates.

### Needs-review admin alert

- When the sync pass flags a game (`needsReview` set this tick, or simply: any
  flagged game whose dedupe key is unclaimed), email `ADMIN_EMAIL` a link to
  `/admin`. Ignores `emailOptOut`.

## Unsubscribe

- `GET /api/unsubscribe?token=<hmac>` — token is `HMAC(userId, SESSION_SECRET)`
  over a stable payload (same signing pattern as `lib/auth/session.ts`; no expiry —
  it can only opt someone out). Sets `emailOptOut = true` and renders a tiny
  confirmation page with a re-subscribe link (same token, reverse action via
  explicit `&resub=1`).
- Admin can also toggle opt-out per player in `/admin` (small addition to the
  players panel).

## Testing (Vitest, matching existing suites)

Pure-function units, no network:

- Reminder eligibility: given picks/enrollment/graded state + a frozen `now`,
  who gets which email (windows, alive-check, <3 picks rule, opt-out, no games
  left → no email).
- Window math around DST boundaries (reuses the ET helpers).
- Week-fully-graded detection incl. canceled and needs-review games.
- Dedupe: claimed key → no duplicate send; failed send → key released.
- Unsubscribe token round-trip and tamper rejection.

The Resend wrapper stays thin and untested; `RESEND_API_KEY` unset in tests makes
all sends no-ops by construction.

## Rollout

1. Migration (users column + notifications table).
2. Ship code with `RESEND_API_KEY` unset — no-op in prod until DNS is verified.
3. Resend account + DNS records + API key in Vercel, redeploy.
4. Tick "notify on failure" on the cron-job.org job (covers stale sync).
5. Sanity-check with a manual `Run sync now` during a reminder window.
