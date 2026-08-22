# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send pick reminders (Sat + Sun 9 AM ET), a weekly recap once a week is fully graded, and a needs-review admin alert, via Resend, riding the existing hourly cron.

**Architecture:** A dependency-free `fetch` wrapper around Resend's REST API; a `notifications` sent-log table whose unique `dedupe_key` makes hourly re-runs idempotent; pure eligibility/window/composition functions (unit-tested) orchestrated by `runNotifyPass()`, called from the existing `/api/cron/sync` route after `runSyncPass()`. Opt-out is a `users.email_opt_out` flag behind an HMAC-signed unsubscribe link.

**Tech Stack:** Next.js App Router (TypeScript), Drizzle ORM + Neon Postgres, Vitest. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-email-notifications-design.md`

## Global Constraints

- **No new npm dependencies.** Resend is called with plain `fetch`.
- **Env vars:** `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `kpick3 <picks@kpick3.com>`). When either is unset, sends are logged no-ops — local dev and tests must never send.
- **Imports** use the `@/` alias (e.g. `@/lib/db`), matching the rest of the repo.
- **Tests** live in `tests/*.test.ts`, pure functions only, no network/DB. Run with `npm test` (Vitest).
- **Typecheck** with `npx tsc --noEmit` before each commit (there is no lint script).
- **ET time handling** must go through the helpers in `lib/picks/line-lock.ts` — never hand-rolled UTC offsets (DST).
- **Dedupe keys** (exact formats): `reminder:<pick3|survivor>:<sat|sun>:<season>:w<week>:u<userId>`, `recap:<season>:w<week>:u<userId>`, `needs_review:g<gameId>`.
- `npm run db:migrate` applies to the `DATABASE_URL` in `.env` (the production Neon DB — this is the repo's normal workflow). All schema changes here are purely additive.
- Comment style: sparse, explaining constraints/invariants only — match the existing files.

---

### Task 1: Schema — `email_opt_out` + `notifications` table

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/0002_*.sql` (generated — do not hand-write)

**Interfaces:**
- Consumes: existing `users` table definition.
- Produces: `users.emailOptOut: boolean` column; `notifications` table export with columns `id, kind, dedupeKey, userId, sentAt` and unique index on `dedupeKey`; type export `Notification`.

- [ ] **Step 1: Add the column and table to the schema**

In `lib/db/schema.ts`, add to the `users` table (after `pinHash`):

```ts
  // Player opted out of reminder/recap emails (admin alerts ignore this).
  emailOptOut: boolean('email_opt_out').notNull().default(false),
```

Add after the `survivorPicks` table definition:

```ts
// Sent-log for outbound email. The unique dedupe key is the idempotency gate for the
// hourly cron: claim the key (insert) before sending; a conflict means already sent.
// Rows are facts about sends — nothing here is derivable state that can drift.
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),            // 'reminder' | 'recap' | 'needs_review'
  dedupeKey: text('dedupe_key').notNull(),
  userId: integer('user_id').references(() => users.id), // null for admin alerts
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byDedupe: uniqueIndex('notifications_dedupe_uq').on(t.dedupeKey),
}))
```

And with the other type exports at the bottom:

```ts
export type Notification = typeof notifications.$inferSelect
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0002_*.sql` file containing `ALTER TABLE "users" ADD COLUMN "email_opt_out" boolean DEFAULT false NOT NULL;` and `CREATE TABLE "notifications" ...` with the unique index. Read the generated SQL and confirm it is only these additive statements.

- [ ] **Step 3: Apply the migration**

Run: `npm run db:migrate`
Expected: completes without error (applies to the Neon DB in `.env`).

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean typecheck, 62 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "Add email_opt_out flag and notifications sent-log table"
```

---

### Task 2: Email sender — `lib/email/send.ts`

**Files:**
- Create: `lib/email/send.ts`
- Modify: `.env.example`
- Test: `tests/email-send.test.ts`

**Interfaces:**
- Consumes: `process.env.RESEND_API_KEY`, `process.env.EMAIL_FROM`.
- Produces: `sendEmail(msg: EmailMessage): Promise<SendResult>` where `EmailMessage = { to: string | string[]; subject: string; html: string; text: string; headers?: Record<string, string> }` and `SendResult = { sent: true } | { sent: false; reason: string }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/email-send.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from '../lib/email/send'

const msg = { to: 'a@b.com', subject: 'hi', html: '<p>hi</p>', text: 'hi' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sendEmail', () => {
  it('is a no-op without RESEND_API_KEY and never touches the network', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('EMAIL_FROM', 'kpick3 <picks@kpick3.com>')
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('network call in no-op mode') }))
    const result = await sendEmail(msg)
    expect(result.sent).toBe(false)
  })

  it('POSTs to Resend and reports success', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key')
    vi.stubEnv('EMAIL_FROM', 'kpick3 <picks@kpick3.com>')
    const fetchMock = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await sendEmail(msg)
    expect(result).toEqual({ sent: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.to).toEqual(['a@b.com'])
    expect(body.from).toBe('kpick3 <picks@kpick3.com>')
  })

  it('reports failure with the status on a non-2xx response', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key')
    vi.stubEnv('EMAIL_FROM', 'kpick3 <picks@kpick3.com>')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 422 })))
    const result = await sendEmail(msg)
    expect(result.sent).toBe(false)
    if (!result.sent) expect(result.reason).toContain('422')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/email-send.test.ts`
Expected: FAIL — cannot resolve `../lib/email/send`.

- [ ] **Step 3: Implement the sender**

Create `lib/email/send.ts`:

```ts
export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export type SendResult = { sent: true } | { sent: false; reason: string }

/**
 * Sends one email via Resend's REST API. Without RESEND_API_KEY/EMAIL_FROM (local
 * dev, tests, pre-DNS prod) it's a logged no-op, so callers run the same code path
 * everywhere but only a configured deployment actually emails anyone.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.log(`[email noop] to=${[msg.to].flat().join(',')} subject="${msg.subject}"`)
    return { sent: false, reason: 'RESEND_API_KEY or EMAIL_FROM not set' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [msg.to].flat(),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.headers ? { headers: msg.headers } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { sent: false, reason: `Resend ${res.status}: ${body.slice(0, 200)}` }
  }
  return { sent: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/email-send.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Document the env vars**

Append to `.env.example`:

```
# Resend API key for outbound email (https://resend.com). Unset = sends are no-ops.
RESEND_API_KEY=

# From address for outbound email, e.g. "kpick3 <picks@kpick3.com>" (domain must be
# verified in Resend). Unset = sends are no-ops.
EMAIL_FROM=
```

- [ ] **Step 6: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

```bash
git add lib/email/send.ts tests/email-send.test.ts .env.example
git commit -m "Add Resend email sender (no-op without credentials)"
```

---

### Task 3: Unsubscribe tokens — `lib/email/unsubscribe.ts`

**Files:**
- Create: `lib/email/unsubscribe.ts`
- Test: `tests/unsubscribe.test.ts`

**Interfaces:**
- Consumes: Node `crypto` (same pattern as `lib/auth/cookie.ts`).
- Produces: `signUnsubscribeToken(userId: number, secret: string): string`, `verifyUnsubscribeToken(token: string, secret: string): number | null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unsubscribe.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { signSession } from '../lib/auth/cookie'
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email/unsubscribe'

const SECRET = 'test-secret'

describe('unsubscribe tokens', () => {
  it('round-trips a user id', () => {
    const token = signUnsubscribeToken(42, SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(42)
  })

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken(42, SECRET)
    const [, sig] = token.split('.')
    const forged = `${Buffer.from('unsub:1').toString('base64url')}.${sig}`
    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull()
  })

  it('rejects the wrong secret', () => {
    const token = signUnsubscribeToken(42, SECRET)
    expect(verifyUnsubscribeToken(token, 'other-secret')).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifyUnsubscribeToken('', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('a.b.c', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('justonepart', SECRET)).toBeNull()
  })

  it('rejects a valid signature over a non-unsub payload', () => {
    // A session token (base64url(email).hmac) must not verify as an unsubscribe token.
    expect(verifyUnsubscribeToken(signSession('a@b.com', SECRET), SECRET)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unsubscribe.test.ts`
Expected: FAIL — cannot resolve `../lib/email/unsubscribe`.

- [ ] **Step 3: Implement**

Create `lib/email/unsubscribe.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto'

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

/**
 * `<base64url("unsub:<userId>")>.<hmac>` — same shape and secret as the session
 * cookie, but a distinct payload prefix so the two token kinds can never cross over.
 * Tokens deliberately never expire: all one can do is toggle email opt-out.
 */
export function signUnsubscribeToken(userId: number, secret: string): string {
  const payload = Buffer.from(`unsub:${userId}`).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** Returns the userId if the signature and payload shape are valid, else null. */
export function verifyUnsubscribeToken(token: string, secret: string): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null

  const expected = sign(payload, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const decoded = Buffer.from(payload, 'base64url').toString('utf8')
  if (!decoded.startsWith('unsub:')) return null
  const id = parseInt(decoded.slice('unsub:'.length), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unsubscribe.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add lib/email/unsubscribe.ts tests/unsubscribe.test.ts
git commit -m "Add HMAC unsubscribe tokens"
```

---

### Task 4: Unsubscribe route — `app/api/unsubscribe/route.ts`

**Files:**
- Create: `app/api/unsubscribe/route.ts`

**Interfaces:**
- Consumes: `verifyUnsubscribeToken` (Task 3), `users.emailOptOut` (Task 1), `process.env.SESSION_SECRET`.
- Produces: `GET /api/unsubscribe?token=<t>` sets `email_opt_out = true`; `&resub=1` sets it back to false. Renders a tiny HTML confirmation.

- [ ] **Step 1: Implement the route**

Create `app/api/unsubscribe/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

export const dynamic = 'force-dynamic'

function page(message: string, link?: { href: string; label: string }): NextResponse {
  const body = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>kpick3</title></head>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center">
<h1 style="font-size:1.25rem">kpick3</h1><p>${message}</p>
${link ? `<p><a href="${link.href}">${link.label}</a></p>` : ''}
</body></html>`
  return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const secret = process.env.SESSION_SECRET
  if (!secret) return page('Server is not configured.')

  const token = req.nextUrl.searchParams.get('token') ?? ''
  const userId = verifyUnsubscribeToken(token, secret)
  if (userId === null) return page('That unsubscribe link is not valid.')

  const resub = req.nextUrl.searchParams.get('resub') === '1'
  const updated = await db
    .update(users)
    .set({ emailOptOut: !resub })
    .where(eq(users.id, userId))
    .returning({ id: users.id })
  if (updated.length === 0) return page('That unsubscribe link is not valid.')

  return resub
    ? page('You are re-subscribed to kpick3 emails.')
    : page('You are unsubscribed from kpick3 reminder and recap emails.', {
        href: `/api/unsubscribe?token=${encodeURIComponent(token)}&resub=1`,
        label: 'Undo — re-subscribe',
      })
}
```

- [ ] **Step 2: Typecheck and test the route end-to-end locally**

Run: `npx tsc --noEmit`
Then start the dev server (`npm run dev`), mint a token for a real user id and curl it:

```bash
./node_modules/.bin/tsx -e "import 'dotenv/config'; import { signUnsubscribeToken } from './lib/email/unsubscribe.ts'; console.log(signUnsubscribeToken(1, process.env.SESSION_SECRET!))"
```

`curl "http://localhost:3000/api/unsubscribe?token=<printed token>"` → expect the "You are unsubscribed" HTML. Then with `&resub=1` → expect the re-subscribed HTML. Confirm the flag flipped both ways:

```bash
./node_modules/.bin/tsx -e "import 'dotenv/config'; import { db } from './lib/db/index.ts'; import { users } from './lib/db/schema.ts'; import { eq } from 'drizzle-orm'; db.select({ o: users.emailOptOut }).from(users).where(eq(users.id, 1)).then(r => { console.log(r); process.exit(0) })"
```

Expected: `email_opt_out` is back to `false` after the resub call. A tampered token returns the "not valid" page and changes nothing.

- [ ] **Step 3: Commit**

```bash
git add app/api/unsubscribe/route.ts
git commit -m "Add unsubscribe route"
```

---

### Task 5: Admin opt-out toggle

**Files:**
- Modify: `app/admin/actions.ts` (append a new action)
- Modify: `app/admin/panels.tsx` (`UserRow` interface ~line 15, `UsersPanel` table header ~line 194, `PlayerRow` ~line 211)
- Modify: `app/admin/page.tsx` (users mapping ~line 40)

**Interfaces:**
- Consumes: `users.emailOptOut` (Task 1); existing `AdminResult`, `requireAdmin`, `Feedback`, `useActionState` patterns.
- Produces: `toggleEmailOptOut(_prev: AdminResult, formData: FormData): Promise<AdminResult>` server action; an "Emails" column in the admin players table.

- [ ] **Step 1: Add the server action**

Append to `app/admin/actions.ts`:

```ts
/** Toggles reminder/recap emails for a player (needs-review alerts to the admin ignore this). */
export async function toggleEmailOptOut(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin()
  const userId = parseInt(String(formData.get('userId')), 10)
  if (!Number.isFinite(userId)) return { error: 'Bad user id.' }

  const rows = await db.select().from(users).where(eq(users.id, userId))
  const player = rows[0]
  if (!player) return { error: 'Player not found.' }

  await db.update(users).set({ emailOptOut: !player.emailOptOut }).where(eq(users.id, userId))
  revalidatePath('/admin')
  return { ok: true, info: `Emails ${player.emailOptOut ? 'on' : 'off'} for ${player.displayName}.` }
}
```

- [ ] **Step 2: Surface it in the players table**

In `app/admin/panels.tsx`:

1. Add `toggleEmailOptOut` to the import list from `./actions`.
2. Add `emailOptOut: boolean` to the `UserRow` interface.
3. In `UsersPanel`, add a fourth header cell after "Role": `<th className="px-3 py-2 font-semibold uppercase tracking-wider">Emails</th>`.
4. In `PlayerRow`, add `const [emailState, emailAction, emailPending] = useActionState(toggleEmailOptOut, {})` next to the existing `useActionState(renamePlayer, {})`, and a fourth `<td>` after the Role cell:

```tsx
      <td className="px-3 py-2">
        <form action={emailAction} className="inline">
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            disabled={emailPending}
            title="Toggle reminder/recap emails for this player"
            className={`cursor-pointer rounded border px-2 py-0.5 text-xs font-bold uppercase disabled:opacity-50 ${
              user.emailOptOut
                ? 'border-line text-muted hover:border-primary'
                : 'border-success text-success'
            }`}
          >
            {user.emailOptOut ? 'Off' : 'On'}
          </button>
        </form>
        <Feedback state={emailState} />
      </td>
```

5. In `app/admin/page.tsx`, add `emailOptOut: u.emailOptOut,` to the `users.map(...)` object passed to `AdminPanels`.

- [ ] **Step 3: Verify in the browser**

Run: `npx tsc --noEmit`, then with the dev server running, open `/admin` (sign in as the admin). Expected: an "Emails" column showing "On" for every player; clicking toggles it to "Off" with a feedback line, and the value survives a reload. Toggle it back on.

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts app/admin/panels.tsx app/admin/page.tsx
git commit -m "Add admin toggle for player email opt-out"
```

---

### Task 6: Reminder windows — export `etParts`, add `lib/notify/windows.ts`

**Files:**
- Modify: `lib/picks/line-lock.ts:4` and `:14` (export `EtParts` and `etParts`)
- Create: `lib/notify/windows.ts`
- Test: `tests/notify-windows.test.ts`

**Interfaces:**
- Consumes: `etParts(d: Date): EtParts` from `lib/picks/line-lock.ts` (currently private — this task exports it unchanged; `EtParts` has `year, month, day, hour, minute, weekday` where `weekday` is `'Sun' | 'Mon' | ...` short names).
- Produces: `type ReminderWindow = 'sat' | 'sun'`; `reminderWindow(now: Date): ReminderWindow | null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/notify-windows.test.ts` (dates verified: 2026-09-12 is a Saturday, 2026-09-13 a Sunday, 2026-12-20 a Sunday; September is EDT = UTC−4, December is EST = UTC−5):

```ts
import { describe, expect, it } from 'vitest'
import { reminderWindow } from '../lib/notify/windows'

describe('reminderWindow', () => {
  it('is null before 9 AM ET on Saturday', () => {
    // 2026-09-12 12:55 UTC = 8:55 AM EDT
    expect(reminderWindow(new Date('2026-09-12T12:55:00Z'))).toBeNull()
  })

  it('opens the sat window from 9 AM ET Saturday', () => {
    // 2026-09-12 13:55 UTC = 9:55 AM EDT — the first hourly cron tick past 9
    expect(reminderWindow(new Date('2026-09-12T13:55:00Z'))).toBe('sat')
  })

  it('stays open through Saturday evening ET', () => {
    // 2026-09-13 02:55 UTC = Sat 10:55 PM EDT
    expect(reminderWindow(new Date('2026-09-13T02:55:00Z'))).toBe('sat')
  })

  it('opens the sun window from 9 AM ET Sunday', () => {
    expect(reminderWindow(new Date('2026-09-13T13:55:00Z'))).toBe('sun')
  })

  it('is null on a weekday', () => {
    // 2026-09-10 is a Thursday
    expect(reminderWindow(new Date('2026-09-10T15:00:00Z'))).toBeNull()
  })

  it('respects EST in winter', () => {
    // 2026-12-20 (Sunday): 13:55 UTC = 8:55 AM EST → closed; 14:55 UTC = 9:55 AM EST → open
    expect(reminderWindow(new Date('2026-12-20T13:55:00Z'))).toBeNull()
    expect(reminderWindow(new Date('2026-12-20T14:55:00Z'))).toBe('sun')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/notify-windows.test.ts`
Expected: FAIL — cannot resolve `../lib/notify/windows`.

- [ ] **Step 3: Export the ET helper and implement the window**

In `lib/picks/line-lock.ts`, change `interface EtParts {` to `export interface EtParts {` and `function etParts(d: Date): EtParts {` to `export function etParts(d: Date): EtParts {`. No other changes.

Create `lib/notify/windows.ts`:

```ts
import { etParts } from '@/lib/picks/line-lock'

export type ReminderWindow = 'sat' | 'sun'

const REMINDER_HOUR_ET = 9

/**
 * Which reminder window `now` falls in: Saturday or Sunday, 9 AM ET to midnight ET.
 * The window is deliberately wide — the hourly cron's first tick past 9 sends, and
 * the dedupe key makes every later tick a no-op, so a missed tick self-heals all day.
 */
export function reminderWindow(now: Date): ReminderWindow | null {
  const p = etParts(now)
  if (p.hour < REMINDER_HOUR_ET) return null
  if (p.weekday === 'Sat') return 'sat'
  if (p.weekday === 'Sun') return 'sun'
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/notify-windows.test.ts`
Expected: 6 PASS.

- [ ] **Step 5: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add lib/picks/line-lock.ts lib/notify/windows.ts tests/notify-windows.test.ts
git commit -m "Add Sat/Sun reminder windows on exported ET helpers"
```

---

### Task 7: Eligibility rules — `lib/notify/eligibility.ts`

**Files:**
- Create: `lib/notify/eligibility.ts`
- Test: `tests/notify-eligibility.test.ts`

**Interfaces:**
- Consumes: nothing project-specific (pure functions over plain data).
- Produces (used verbatim by Tasks 9–10):
  - `interface ReminderGame { kickoff: Date; statusState: string; canceled: boolean; homeTeamAbbr: string; awayTeamAbbr: string }`
  - `pickableGames<T extends ReminderGame>(games: T[], now: Date): T[]`
  - `needsPick3Reminder(pickCount: number, games: ReminderGame[], now: Date): boolean`
  - `interface SurvivorReminderState { enrolled: boolean; alive: boolean; hasPickThisWeek: boolean; usedTeams: Set<string> }`
  - `needsSurvivorReminder(s: SurvivorReminderState, games: ReminderGame[], now: Date): boolean`
  - `interface RecapGame { completed: boolean; canceled: boolean; gradedAt: Date | null; needsReview: boolean }`
  - `weekFullyGraded(games: RecapGame[]): boolean`

- [ ] **Step 1: Write the failing tests**

Create `tests/notify-eligibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  needsPick3Reminder,
  needsSurvivorReminder,
  pickableGames,
  weekFullyGraded,
  type RecapGame,
  type ReminderGame,
} from '../lib/notify/eligibility'

const now = new Date('2026-09-13T14:00:00Z')
const future = new Date('2026-09-13T17:00:00Z')
const past = new Date('2026-09-13T00:20:00Z')

function game(overrides: Partial<ReminderGame> = {}): ReminderGame {
  return {
    kickoff: future,
    statusState: 'pre',
    canceled: false,
    homeTeamAbbr: 'KC',
    awayTeamAbbr: 'LAC',
    ...overrides,
  }
}

describe('pickableGames', () => {
  it('keeps only future, pre-status, non-canceled games', () => {
    const games = [
      game(),
      game({ kickoff: past }),
      game({ statusState: 'in' }),
      game({ canceled: true }),
    ]
    expect(pickableGames(games, now)).toHaveLength(1)
  })
})

describe('needsPick3Reminder', () => {
  it('reminds a player with 0, 1 or 2 picks while games remain', () => {
    expect(needsPick3Reminder(0, [game()], now)).toBe(true)
    expect(needsPick3Reminder(2, [game()], now)).toBe(true)
  })

  it('does not remind with 3 picks in', () => {
    expect(needsPick3Reminder(3, [game()], now)).toBe(false)
  })

  it('does not remind when nothing is pickable', () => {
    expect(needsPick3Reminder(0, [game({ kickoff: past })], now)).toBe(false)
  })
})

describe('needsSurvivorReminder', () => {
  const base = { enrolled: true, alive: true, hasPickThisWeek: false, usedTeams: new Set<string>() }

  it('reminds an alive, enrolled, pickless player with a usable game', () => {
    expect(needsSurvivorReminder(base, [game()], now)).toBe(true)
  })

  it('skips non-enrolled, eliminated, and already-picked players', () => {
    expect(needsSurvivorReminder({ ...base, enrolled: false }, [game()], now)).toBe(false)
    expect(needsSurvivorReminder({ ...base, alive: false }, [game()], now)).toBe(false)
    expect(needsSurvivorReminder({ ...base, hasPickThisWeek: true }, [game()], now)).toBe(false)
  })

  it('skips when both sides of every pickable game are already used', () => {
    const used = { ...base, usedTeams: new Set(['KC', 'LAC']) }
    expect(needsSurvivorReminder(used, [game()], now)).toBe(false)
    // One free side is enough.
    expect(needsSurvivorReminder({ ...base, usedTeams: new Set(['KC']) }, [game()], now)).toBe(true)
  })
})

describe('weekFullyGraded', () => {
  const graded: RecapGame = { completed: true, canceled: false, gradedAt: now, needsReview: false }

  it('is true when every game is graded and none flagged', () => {
    expect(weekFullyGraded([graded, graded])).toBe(true)
  })

  it('is false with an ungraded or flagged game', () => {
    expect(weekFullyGraded([graded, { ...graded, gradedAt: null }])).toBe(false)
    expect(weekFullyGraded([graded, { ...graded, needsReview: true, gradedAt: null }])).toBe(false)
  })

  it('tolerates canceled games (graded as void) but requires a real finished game', () => {
    const canceledVoided: RecapGame = { completed: false, canceled: true, gradedAt: now, needsReview: false }
    expect(weekFullyGraded([graded, canceledVoided])).toBe(true)
    expect(weekFullyGraded([canceledVoided])).toBe(false)
    expect(weekFullyGraded([])).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/notify-eligibility.test.ts`
Expected: FAIL — cannot resolve `../lib/notify/eligibility`.

- [ ] **Step 3: Implement**

Create `lib/notify/eligibility.ts`:

```ts
export interface ReminderGame {
  kickoff: Date
  statusState: string
  canceled: boolean
  homeTeamAbbr: string
  awayTeamAbbr: string
}

/** Games a pick can still be made on: not canceled, still 'pre', kickoff in the future. */
export function pickableGames<T extends ReminderGame>(games: T[], now: Date): T[] {
  return games.filter((g) => !g.canceled && g.statusState === 'pre' && g.kickoff > now)
}

/** Pick3: remind anyone with fewer than 3 picks while pickable games remain. */
export function needsPick3Reminder(pickCount: number, games: ReminderGame[], now: Date): boolean {
  return pickCount < 3 && pickableGames(games, now).length > 0
}

export interface SurvivorReminderState {
  enrolled: boolean
  alive: boolean
  hasPickThisWeek: boolean
  usedTeams: Set<string>
}

/**
 * Survivor: enrolled, still alive, no live pick this week, and at least one pickable
 * game with a side they haven't burned (mirrors getSurvivorBannerStatus's rule).
 */
export function needsSurvivorReminder(
  s: SurvivorReminderState,
  games: ReminderGame[],
  now: Date
): boolean {
  if (!s.enrolled || !s.alive || s.hasPickThisWeek) return false
  return pickableGames(games, now).some(
    (g) => !s.usedTeams.has(g.homeTeamAbbr) || !s.usedTeams.has(g.awayTeamAbbr)
  )
}

export interface RecapGame {
  completed: boolean
  canceled: boolean
  gradedAt: Date | null
  needsReview: boolean
}

/**
 * A week is recap-ready once every game is graded (canceled games get gradedAt when
 * voided), nothing is flagged for review, and at least one game actually finished —
 * a flagged final therefore holds the recap until the admin confirms it.
 */
export function weekFullyGraded(games: RecapGame[]): boolean {
  if (games.length === 0) return false
  if (!games.some((g) => g.completed && !g.canceled)) return false
  return games.every((g) => g.gradedAt !== null && !g.needsReview)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/notify-eligibility.test.ts`
Expected: all PASS.

- [ ] **Step 5: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add lib/notify/eligibility.ts tests/notify-eligibility.test.ts
git commit -m "Add pure notification eligibility rules"
```

---

### Task 8: Email composition — `lib/notify/emails.ts`

**Files:**
- Create: `lib/notify/emails.ts`
- Test: `tests/notify-emails.test.ts`

**Interfaces:**
- Consumes: `formatKickoff(d: Date): string` from `@/lib/format`; `type PickResult` from `@/lib/picks/grading`.
- Produces (used verbatim by Tasks 9–11):
  - `const SITE_URL = 'https://kpick3.com'` (exported)
  - `interface EmailContent { subject: string; html: string; text: string }`
  - `interface ReminderEmailInput { displayName: string; window: 'sat' | 'sun'; week: number; pick3: { pickCount: number; nextKickoff: Date } | null; survivor: { remainingPickable: number } | null; unsubscribeUrl: string }`
  - `reminderEmail(input: ReminderEmailInput): EmailContent`
  - `interface RecapPickLine { label: string; result: PickResult }`
  - `interface RecapStandingsRow { displayName: string; points: number; isYou: boolean }`
  - `interface RecapEmailInput { displayName: string; week: number; myPicks: RecapPickLine[]; weekPoints: number; parlay: boolean; standings: RecapStandingsRow[]; survivorEliminated: string[]; survivorChampions: string[]; unsubscribeUrl: string }`
  - `recapEmail(input: RecapEmailInput): EmailContent`
  - `interface FlaggedGameLine { week: number; awayTeamAbbr: string; homeTeamAbbr: string }`
  - `needsReviewEmail(flagged: FlaggedGameLine[]): EmailContent`

- [ ] **Step 1: Write the failing tests**

Create `tests/notify-emails.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { needsReviewEmail, recapEmail, reminderEmail } from '../lib/notify/emails'

const unsubscribeUrl = 'https://kpick3.com/api/unsubscribe?token=tok'

describe('reminderEmail', () => {
  const base = {
    displayName: 'Alex',
    window: 'sat' as const,
    week: 3,
    pick3: { pickCount: 1, nextKickoff: new Date('2026-09-20T17:00:00Z') },
    survivor: { remainingPickable: 8 },
    unsubscribeUrl,
  }

  it('mentions the week, both pools, and the unsubscribe link', () => {
    const { subject, html, text } = reminderEmail(base)
    expect(subject).toContain('Week 3')
    expect(html).toContain('1/3')
    expect(html).toContain('survivor')
    expect(html).toContain(unsubscribeUrl)
    expect(text).toContain(unsubscribeUrl)
  })

  it('marks the Sunday email as last call and omits absent pools', () => {
    const sun = reminderEmail({ ...base, window: 'sun', survivor: null })
    expect(sun.subject.toLowerCase()).toContain('last call')
    expect(sun.html).not.toContain('survivor')
  })

  it('escapes HTML in display names', () => {
    const evil = reminderEmail({ ...base, displayName: '<b>x</b>' })
    expect(evil.html).not.toContain('<b>x</b>')
    expect(evil.html).toContain('&lt;b&gt;')
  })
})

describe('recapEmail', () => {
  it('shows picks, points, standings and survivor news', () => {
    const { subject, html, text } = recapEmail({
      displayName: 'Alex',
      week: 3,
      myPicks: [
        { label: 'KC −3.5 vs LAC', result: 'win' },
        { label: 'BUF +2.5 @ NYJ', result: 'loss' },
        { label: 'DAL −1.0 vs PHI', result: 'push' },
      ],
      weekPoints: 1,
      parlay: false,
      standings: [
        { displayName: 'Sam', points: 10, isYou: false },
        { displayName: 'Alex', points: 8, isYou: true },
      ],
      survivorEliminated: ['Pat'],
      survivorChampions: [],
      unsubscribeUrl,
    })
    expect(subject).toContain('Week 3')
    expect(html).toContain('KC −3.5 vs LAC')
    expect(html).toContain('Pat')
    expect(html).toContain(unsubscribeUrl)
    expect(text).toContain('1 point')
  })
})

describe('needsReviewEmail', () => {
  it('lists the flagged games and links to /admin', () => {
    const { subject, html } = needsReviewEmail([
      { week: 3, awayTeamAbbr: 'LAC', homeTeamAbbr: 'KC' },
    ])
    expect(subject).toContain('review')
    expect(html).toContain('LAC @ KC')
    expect(html).toContain('/admin')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/notify-emails.test.ts`
Expected: FAIL — cannot resolve `../lib/notify/emails`.

- [ ] **Step 3: Implement**

Create `lib/notify/emails.ts`:

```ts
import { formatKickoff } from '@/lib/format'
import type { PickResult } from '@/lib/picks/grading'

export const SITE_URL = 'https://kpick3.com'

export interface EmailContent {
  subject: string
  html: string
  text: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function layout(bodyHtml: string, unsubscribeUrl: string | null): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:0 auto;padding:16px;color:#222">
<h2 style="margin:0 0 12px;font-size:18px"><a href="${SITE_URL}" style="color:#222;text-decoration:none">kpick3</a></h2>
${bodyHtml}
${unsubscribeUrl ? `<p style="margin-top:28px;font-size:12px;color:#888"><a href="${unsubscribeUrl}" style="color:#888">Unsubscribe from these emails</a></p>` : ''}
</div>`
}

export interface ReminderEmailInput {
  displayName: string
  window: 'sat' | 'sun'
  week: number
  pick3: { pickCount: number; nextKickoff: Date } | null
  survivor: { remainingPickable: number } | null
  unsubscribeUrl: string
}

export function reminderEmail(input: ReminderEmailInput): EmailContent {
  const prefix = input.window === 'sun' ? 'Last call: ' : ''
  const subject = `${prefix}Week ${input.week} picks — kpick3`

  const lines: string[] = []
  if (input.pick3) {
    const missing = 3 - input.pick3.pickCount
    lines.push(
      `You have ${input.pick3.pickCount}/3 pick’em picks in — ${missing} more to make. ` +
        `Next kickoff: ${formatKickoff(input.pick3.nextKickoff)}.`
    )
  }
  if (input.survivor) {
    const n = input.survivor.remainingPickable
    lines.push(
      `No survivor pick yet — ${n} usable game${n === 1 ? '' : 's'} left this week. ` +
        `Miss the week and you’re out.`
    )
  }

  const text = `Hey ${input.displayName},\n\n${lines.join('\n\n')}\n\nMake your picks: ${SITE_URL}\n\nUnsubscribe: ${input.unsubscribeUrl}\n`
  const html = layout(
    `<p>Hey ${esc(input.displayName)},</p>` +
      lines.map((l) => `<p>${esc(l)}</p>`).join('') +
      `<p><a href="${SITE_URL}" style="font-weight:bold">Make your picks →</a></p>`,
    input.unsubscribeUrl
  )
  return { subject, html, text }
}

export interface RecapPickLine {
  label: string // e.g. "KC −3.5 vs LAC"
  result: PickResult
}

export interface RecapStandingsRow {
  displayName: string
  points: number
  isYou: boolean
}

export interface RecapEmailInput {
  displayName: string
  week: number
  myPicks: RecapPickLine[]
  weekPoints: number
  parlay: boolean
  standings: RecapStandingsRow[]
  survivorEliminated: string[]
  survivorChampions: string[]
  unsubscribeUrl: string
}

const RESULT_MARK: Record<PickResult, string> = {
  win: '✓', loss: '✗', push: '–', void: '–', pending: '·',
}

export function recapEmail(input: RecapEmailInput): EmailContent {
  const subject = `Week ${input.week} results — kpick3`

  const pickLines = input.myPicks.map((p) => `${RESULT_MARK[p.result]} ${p.label} (${p.result})`)
  const pointsLine =
    `You scored ${input.weekPoints} point${input.weekPoints === 1 ? '' : 's'} in week ${input.week}` +
    (input.parlay ? ' — 3-for-3 parlay! 🎉' : '.')
  const standingsLines = input.standings.map(
    (s, i) => `${i + 1}. ${s.displayName}${s.isYou ? ' (you)' : ''} — ${s.points} pts`
  )
  const survivorLines = [
    ...(input.survivorEliminated.length > 0
      ? [`Survivor eliminations: ${input.survivorEliminated.join(', ')}`]
      : []),
    ...(input.survivorChampions.length > 0
      ? [`Survivor champion${input.survivorChampions.length > 1 ? 's' : ''}: ${input.survivorChampions.join(', ')} 🏆`]
      : []),
  ]

  const text =
    `Hey ${input.displayName},\n\n${pointsLine}\n\n` +
    (pickLines.length > 0 ? `Your picks:\n${pickLines.join('\n')}\n\n` : `You made no picks this week.\n\n`) +
    `Standings:\n${standingsLines.join('\n')}\n\n` +
    (survivorLines.length > 0 ? `${survivorLines.join('\n')}\n\n` : '') +
    `Full results: ${SITE_URL}\n\nUnsubscribe: ${input.unsubscribeUrl}\n`

  const html = layout(
    `<p>Hey ${esc(input.displayName)},</p><p>${esc(pointsLine)}</p>` +
      (pickLines.length > 0
        ? `<ul style="padding-left:20px">${input.myPicks.map((p) => `<li>${RESULT_MARK[p.result]} ${esc(p.label)} <em>(${p.result})</em></li>`).join('')}</ul>`
        : `<p>You made no picks this week.</p>`) +
      `<p><strong>Standings</strong></p><ol style="padding-left:20px">${input.standings
        .map((s) => `<li>${esc(s.displayName)}${s.isYou ? ' <strong>(you)</strong>' : ''} — ${s.points} pts</li>`)
        .join('')}</ol>` +
      survivorLines.map((l) => `<p>${esc(l)}</p>`).join('') +
      `<p><a href="${SITE_URL}/standings">Full standings →</a></p>`,
    input.unsubscribeUrl
  )
  return { subject, html, text }
}

export interface FlaggedGameLine {
  week: number
  awayTeamAbbr: string
  homeTeamAbbr: string
}

export function needsReviewEmail(flagged: FlaggedGameLine[]): EmailContent {
  const subject = `⚠ ${flagged.length} game${flagged.length === 1 ? '' : 's'} need review — kpick3`
  const lines = flagged.map((g) => `Week ${g.week}: ${g.awayTeamAbbr} @ ${g.homeTeamAbbr}`)
  const text = `${lines.join('\n')}\n\nConfirm the finals: ${SITE_URL}/admin\n`
  const html = layout(
    `<p>These games went final with a missing or suspect score and picks are ungraded until you confirm:</p>` +
      `<ul style="padding-left:20px">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` +
      `<p><a href="${SITE_URL}/admin" style="font-weight:bold">Review in /admin →</a></p>`,
    null
  )
  return { subject, html, text }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/notify-emails.test.ts`
Expected: all PASS.

- [ ] **Step 5: Typecheck, full suite, commit**

Run: `npx tsc --noEmit && npm test`

```bash
git add lib/notify/emails.ts tests/notify-emails.test.ts
git commit -m "Add reminder, recap and needs-review email composition"
```

---

### Task 9: Notify pass — dedupe claims + reminder sending

**Files:**
- Create: `lib/notify/pass.ts`

**Interfaces:**
- Consumes: `notifications` table (Task 1); `sendEmail` (Task 2); `signUnsubscribeToken` (Task 3); `reminderWindow` (Task 6); `needsPick3Reminder`, `needsSurvivorReminder`, `pickableGames` (Task 7); `reminderEmail`, `SITE_URL` (Task 8); existing queries `getCurrentSeason`, `getCurrentWeek`, `getGamesForWeek`, `getUserPicksForWeek` from `@/lib/picks/queries` and `isEnrolled`, `getSurvivorStatusForUser`, `getUserSurvivorPickForWeek`, `getUsedTeams` from `@/lib/survivor/queries`.
- Produces: `runNotifyPass(now?: Date): Promise<{ reminders: number; recaps: number; adminAlerts: number }>` — this task implements the scaffold plus reminders; `recaps`/`adminAlerts` return 0 until Tasks 10–11 fill in `runRecapPass`/`runAdminAlertPass`.

- [ ] **Step 1: Implement the pass scaffold, dedupe helpers, and reminders**

Create `lib/notify/pass.ts`:

```ts
import { db } from '@/lib/db'
import { notifications, users } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import {
  getCurrentSeason,
  getCurrentWeek,
  getGamesForWeek,
  getUserPicksForWeek,
} from '@/lib/picks/queries'
import {
  getSurvivorStatusForUser,
  getUsedTeams,
  getUserSurvivorPickForWeek,
  isEnrolled,
} from '@/lib/survivor/queries'
import { sendEmail } from '@/lib/email/send'
import { signUnsubscribeToken } from '@/lib/email/unsubscribe'
import { reminderWindow } from './windows'
import { needsPick3Reminder, needsSurvivorReminder, pickableGames } from './eligibility'
import { reminderEmail, SITE_URL } from './emails'

/**
 * Runs after every sync pass. Each sub-pass is independently fault-isolated and every
 * send sits behind a dedupe-key claim, so the hourly cron can re-run all of this
 * freely — the second tick of a window is a pile of no-ops.
 */
export async function runNotifyPass(now: Date = new Date()) {
  const [reminders, recaps, adminAlerts] = [
    await runReminderPass(now).catch((err) => { console.error('[notify] reminders failed:', err); return 0 }),
    await runRecapPass(now).catch((err) => { console.error('[notify] recaps failed:', err); return 0 }),
    await runAdminAlertPass().catch((err) => { console.error('[notify] admin alerts failed:', err); return 0 }),
  ]
  return { reminders, recaps, adminAlerts }
}

/** Claims a dedupe key. True = ours to send; false = a previous tick already sent it. */
async function claimKey(kind: string, dedupeKey: string, userId: number | null): Promise<boolean> {
  const rows = await db
    .insert(notifications)
    .values({ kind, dedupeKey, userId })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id })
  return rows.length > 0
}

/** Releases claims after a failed send so the next hourly tick retries. */
async function releaseKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await db.delete(notifications).where(inArray(notifications.dedupeKey, keys))
}

function unsubscribeUrl(userId: number): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(userId, secret))}`
}

async function runReminderPass(now: Date): Promise<number> {
  const window = reminderWindow(now)
  if (!window) return 0
  const season = await getCurrentSeason()
  if (season === null) return 0
  const week = await getCurrentWeek(season)
  const weekGames = await getGamesForWeek(season, week)
  if (pickableGames(weekGames, now).length === 0) return 0

  const players = await db.select().from(users).where(eq(users.emailOptOut, false))

  let sent = 0
  for (const player of players) {
    const myPicks = await getUserPicksForWeek(player.id, season, week)
    const wantsPick3 = needsPick3Reminder(myPicks.length, weekGames, now)

    let wantsSurvivor = false
    let survivorPickable = 0
    if (await isEnrolled(player.id, season)) {
      const [status, existingPick, used] = await Promise.all([
        getSurvivorStatusForUser(player.id, season),
        getUserSurvivorPickForWeek(player.id, season, week),
        getUsedTeams(player.id, season),
      ])
      const usedSet = new Set(used.keys())
      const state = {
        enrolled: true,
        alive: status.alive,
        hasPickThisWeek: existingPick !== null,
        usedTeams: usedSet,
      }
      wantsSurvivor = needsSurvivorReminder(state, weekGames, now)
      survivorPickable = pickableGames(weekGames, now).filter(
        (g) => !usedSet.has(g.homeTeamAbbr) || !usedSet.has(g.awayTeamAbbr)
      ).length
    }

    if (!wantsPick3 && !wantsSurvivor) continue

    // Claim per-pool keys, then send one combined email covering both.
    const claimed: string[] = []
    if (wantsPick3) {
      const key = `reminder:pick3:${window}:${season}:w${week}:u${player.id}`
      if (await claimKey('reminder', key, player.id)) claimed.push(key)
    }
    if (wantsSurvivor) {
      const key = `reminder:survivor:${window}:${season}:w${week}:u${player.id}`
      if (await claimKey('reminder', key, player.id)) claimed.push(key)
    }
    if (claimed.length === 0) continue // every needed pool already sent this window

    const unsub = unsubscribeUrl(player.id)
    const nextKickoff = pickableGames(weekGames, now)[0]?.kickoff ?? null
    const content = reminderEmail({
      displayName: player.displayName,
      window,
      week,
      pick3: wantsPick3 && nextKickoff ? { pickCount: myPicks.length, nextKickoff } : null,
      survivor: wantsSurvivor ? { remainingPickable: survivorPickable } : null,
      unsubscribeUrl: unsub,
    })
    const result = await sendEmail({
      to: player.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      headers: { 'List-Unsubscribe': `<${unsub}>` },
    })
    if (!result.sent) {
      await releaseKeys(claimed)
      console.error(`[notify] reminder to ${player.email} failed: ${result.reason}`)
      continue
    }
    sent++
  }
  return sent
}

async function runRecapPass(_now: Date): Promise<number> {
  return 0 // implemented in the next task
}

async function runAdminAlertPass(): Promise<number> {
  return 0 // implemented in a later task
}
```

Note: `getGamesForWeek` returns full `Game` rows, which structurally satisfy `ReminderGame` — no mapping needed.

Note: the spec lists dedupe (claimed key → no duplicate; failed send → key released) among the test cases, but `claimKey`/`releaseKeys` are DB-bound and this repo has no DB-mocking infrastructure — the unique index IS the mechanism. It's verified by the dry-run in Step 3 (and the eligibility around it is unit-tested); don't invent a mocking layer for it.

- [ ] **Step 2: Typecheck and full suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 3: Dry-run against the real DB (no-op sends)**

With `RESEND_API_KEY` unset in `.env`, run:

```bash
./node_modules/.bin/tsx -e "import 'dotenv/config'; import { runNotifyPass } from './lib/notify/pass.ts'; runNotifyPass(new Date()).then((r) => { console.log(r); process.exit(0) })"
```

Expected: `{ reminders: 0, recaps: 0, adminAlerts: 0 }` on a weekday (window closed), no errors. Then force a window to see the claim/no-op path:

```bash
./node_modules/.bin/tsx -e "import 'dotenv/config'; import { runNotifyPass } from './lib/notify/pass.ts'; runNotifyPass(new Date('2026-09-13T14:00:00Z')).then((r) => { console.log(r); process.exit(0) })"
```

Expected: `[email noop]` log lines for eligible players and `reminders: 0` (no-op sends report `sent: false`, so keys are released — nothing is falsely marked sent before Resend is configured). Confirm the `notifications` table is empty afterwards:

```bash
./node_modules/.bin/tsx -e "import 'dotenv/config'; import { db } from './lib/db/index.ts'; import { notifications } from './lib/db/schema.ts'; db.select().from(notifications).then((r) => { console.log(r); process.exit(0) })"
```

- [ ] **Step 4: Commit**

```bash
git add lib/notify/pass.ts
git commit -m "Add notify pass with dedupe claims and pick reminders"
```

---

### Task 10: Notify pass — weekly recap

**Files:**
- Modify: `lib/notify/pass.ts` (replace the `runRecapPass` stub)

**Interfaces:**
- Consumes: `weekFullyGraded` (Task 7); `recapEmail` (Task 8); `getStandings`, `getUserPicksForWeek`, `getGamesForWeek` from `@/lib/picks/queries`; `getSurvivorSeasonData` from `@/lib/survivor/queries`; `weeklyPoints` and `type PickResult` from `@/lib/picks/grading`; `formatSpread` from `@/lib/format`.
- Produces: `runRecapPass(now: Date): Promise<number>` (private to `pass.ts`; already wired into `runNotifyPass`).

- [ ] **Step 1: Implement the recap pass**

In `lib/notify/pass.ts`, add to the imports:

```ts
import { getStandings } from '@/lib/picks/queries'         // merge into the existing import
import { getSurvivorSeasonData } from '@/lib/survivor/queries' // merge into the existing import
import { weeklyPoints, type PickResult } from '@/lib/picks/grading'
import { formatSpread } from '@/lib/format'
import { weekFullyGraded } from './eligibility'            // merge into the existing import
import { recapEmail } from './emails'                      // merge into the existing import
```

Replace the `runRecapPass` stub with:

```ts
/**
 * Recaps target the current AND previous week: the sync's auto-detected week rolls
 * forward around Tuesday — exactly when the finished week's recap comes due — and the
 * two-week bound keeps a mid-season deploy from backfilling the whole past season.
 */
async function runRecapPass(now: Date): Promise<number> {
  const season = await getCurrentSeason()
  if (season === null) return 0
  const currentWeek = await getCurrentWeek(season)
  const targetWeeks = [...new Set([currentWeek, currentWeek - 1])].filter((w) => w >= 1)

  let sent = 0
  for (const week of targetWeeks) {
    const weekGames = await getGamesForWeek(season, week)
    if (!weekFullyGraded(weekGames)) continue

    const players = await db.select().from(users).where(eq(users.emailOptOut, false))
    const standingsRows = await getStandings(season)
    // viewerId 0 = no viewer: cell visibility doesn't matter here, statuses/champions do.
    const survivor = await getSurvivorSeasonData(season, 0)
    const eliminated = survivor.rows
      .filter((r) => r.status.eliminatedWeek === week)
      .map((r) => r.displayName)
    const champions = survivor.champions.over && survivor.champions.decidedWeek === week
      ? survivor.rows.filter((r) => survivor.champions.championUserIds.includes(r.userId)).map((r) => r.displayName)
      : []
    const gameById = new Map(weekGames.map((g) => [g.id, g]))

    for (const player of players) {
      const key = `recap:${season}:w${week}:u${player.id}`
      if (!(await claimKey('recap', key, player.id))) continue

      const myPicks = await getUserPicksForWeek(player.id, season, week)
      const results = myPicks.map((p) => p.result as PickResult)
      const { points, parlay } = weeklyPoints(results)
      const pickLines = myPicks.map((p) => {
        const g = gameById.get(p.gameId)
        const label = g
          ? p.side === 'home'
            ? `${g.homeTeamAbbr} ${formatSpread(p.lockedSpread)} vs ${g.awayTeamAbbr}`
            : `${g.awayTeamAbbr} ${formatSpread(p.lockedSpread)} @ ${g.homeTeamAbbr}`
          : `game ${p.gameId}`
        return { label, result: p.result as PickResult }
      })
      const topStandings = standingsRows.slice(0, 5).map((s) => ({
        displayName: s.displayName, points: s.points, isYou: s.userId === player.id,
      }))
      const myRank = standingsRows.findIndex((s) => s.userId === player.id)
      if (myRank >= 5) {
        const s = standingsRows[myRank]
        topStandings.push({ displayName: s.displayName, points: s.points, isYou: true })
      }

      const unsub = unsubscribeUrl(player.id)
      const content = recapEmail({
        displayName: player.displayName,
        week,
        myPicks: pickLines,
        weekPoints: points,
        parlay,
        standings: topStandings,
        survivorEliminated: eliminated,
        survivorChampions: champions,
        unsubscribeUrl: unsub,
      })
      const result = await sendEmail({
        to: player.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
        headers: { 'List-Unsubscribe': `<${unsub}>` },
      })
      if (!result.sent) {
        await releaseKeys([key])
        console.error(`[notify] recap to ${player.email} failed: ${result.reason}`)
        continue
      }
      sent++
    }
  }
  return sent
}
```

- [ ] **Step 2: Typecheck and full suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 3: Dry-run the recap path**

The 2026 season hasn't started (16 week-1 games, none graded), so live data exercises the "not fully graded → skip" path:

```bash
./node_modules/.bin/tsx -e "import 'dotenv/config'; import { runNotifyPass } from './lib/notify/pass.ts'; runNotifyPass(new Date('2026-09-16T14:00:00Z')).then((r) => { console.log(r); process.exit(0) })"
```

Expected: `recaps: 0`, no errors, no stray `[email noop]` recap lines (week 1 is not graded). The full send path gets its first live exercise after week 1 grades in production — with the no-op sender until Resend is configured.

- [ ] **Step 4: Commit**

```bash
git add lib/notify/pass.ts
git commit -m "Send weekly recap emails once a week is fully graded"
```

---

### Task 11: Notify pass — admin alerts, cron wiring, docs

**Files:**
- Modify: `lib/notify/pass.ts` (replace the `runAdminAlertPass` stub)
- Modify: `app/api/cron/sync/route.ts:16-17`
- Modify: `README.md` (Local setup, Deploy, Scheduled sync sections)

**Interfaces:**
- Consumes: `needsReviewEmail` (Task 8); `games.needsReview`; `process.env.ADMIN_EMAIL`; `runNotifyPass` (Task 9).
- Produces: cron response gains `notified: { reminders, recaps, adminAlerts } | { error: string }`.

- [ ] **Step 1: Implement the admin alert pass**

In `lib/notify/pass.ts`, add `games` to the schema import and `needsReviewEmail` to the emails import, then replace the `runAdminAlertPass` stub with:

```ts
/**
 * Emails the super admin about newly flagged finals. One email per batch of new
 * flags; each game alerts once ever (resolving it clears the flag, and re-flagging
 * the same game id stays deduped — acceptable for this failure mode).
 */
async function runAdminAlertPass(): Promise<number> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return 0

  const flagged = await db.select().from(games).where(eq(games.needsReview, true))
  const fresh: typeof flagged = []
  const claimed: string[] = []
  for (const g of flagged) {
    const key = `needs_review:g${g.id}`
    if (await claimKey('needs_review', key, null)) {
      fresh.push(g)
      claimed.push(key)
    }
  }
  if (fresh.length === 0) return 0

  const content = needsReviewEmail(
    fresh.map((g) => ({ week: g.week, awayTeamAbbr: g.awayTeamAbbr, homeTeamAbbr: g.homeTeamAbbr }))
  )
  const result = await sendEmail({
    to: adminEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
  })
  if (!result.sent) {
    await releaseKeys(claimed)
    console.error(`[notify] admin alert failed: ${result.reason}`)
    return 0
  }
  return 1
}
```

- [ ] **Step 2: Wire the notify pass into the cron route**

In `app/api/cron/sync/route.ts`, add `import { runNotifyPass } from '@/lib/notify/pass'` and replace the last two lines of `GET` with:

```ts
  const result = await runSyncPass()
  // Notifications ride the same cron but must never fail the sync response.
  let notified: Awaited<ReturnType<typeof runNotifyPass>> | { error: string }
  try {
    notified = await runNotifyPass()
  } catch (err) {
    notified = { error: err instanceof Error ? err.message : 'notify failed' }
  }
  return NextResponse.json({ ok: true, ...result, notified })
```

- [ ] **Step 3: Update the README**

1. **Local setup step 2**: after the existing env list, add: "Optional: `RESEND_API_KEY` + `EMAIL_FROM` enable outbound email (reminders, recaps, admin alerts); leave them unset and all sends are logged no-ops."
2. **Deploy step 2**: add `RESEND_API_KEY` and `EMAIL_FROM` to the Vercel env list, with: "create a free [Resend](https://resend.com) account, verify `kpick3.com` (DNS records at the registrar), and mint an API key."
3. **Scheduled sync section**: add a paragraph:

```markdown
The same cron pass also sends email: pick reminders (Sat + Sun from 9 AM ET to
anyone missing picks), a weekly recap once every game of a week is graded, and a
needs-review alert to the admin. Sends are deduped in the `notifications` table, so
hourly re-runs never double-send. **Turn on cron-job.org's "notify on failure"
setting** — a dead cron can't email you about itself, so the scheduler's own
failure alert (plus the `/admin` stale banner) covers that case.
```

4. **How it works section**: add a bullet: "- **Email**: reminders, weekly recaps and admin alerts go out via Resend, riding the sync cron. Players can opt out via the unsubscribe link in any email (or the admin toggle in `/admin`)."

- [ ] **Step 4: Verify the full pass end-to-end**

Run: `npx tsc --noEmit && npm test`
Then hit the cron route locally (dev server running, `RESEND_API_KEY` unset):

```bash
curl -s "http://localhost:3000/api/cron/sync?secret=$(grep '^CRON_SECRET=' .env | cut -d= -f2)"
```

Expected: JSON containing `"ok":true`, the usual sync counts, and `"notified":{"reminders":0,"recaps":0,"adminAlerts":0}` (no window open, nothing graded, nothing flagged — and no-op sends can't inflate the counts).

- [ ] **Step 5: Commit**

```bash
git add lib/notify/pass.ts app/api/cron/sync/route.ts README.md
git commit -m "Wire notifications into the cron sync and document rollout"
```

---

## Manual rollout (after the code ships — user actions, not code)

1. Create a Resend account; add their DNS records for `kpick3.com` at the registrar; wait for verification; mint an API key.
2. In Vercel (Production + Preview): set `RESEND_API_KEY` and `EMAIL_FROM=kpick3 <picks@kpick3.com>`; redeploy (env changes only apply to the next deployment).
3. On cron-job.org: enable the job's failure notification (covers stale sync — deliberately not in code).
4. First Saturday of the season, spot-check: `/admin` → Run sync now during the window, or watch the cron response's `notified` counts; confirm the reminder lands and its unsubscribe link works.
