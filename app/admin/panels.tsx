'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  addUser,
  enrollSurvivorPlayer,
  removePlayer,
  renamePlayer,
  resolveFlaggedGame,
  runSyncNow,
  sendTestEmail,
  toggleEmailPref,
  unenrollSurvivorPlayer,
  voidGamePicks,
  type AdminResult,
} from './actions'

interface UserRow {
  id: number
  email: string
  displayName: string
  isAdmin: boolean
  emailReminders: boolean
  emailRecaps: boolean
  /** Pre-formatted ET timestamp of their last page load, or null if they've never visited. */
  lastSeen: string | null
  /** The signed-in admin's own row — never removable. */
  isSelf: boolean
  pickCount: number
  survivorPickCount: number
}

interface FlaggedGame {
  id: number
  label: string
  detail: string
  homeAbbr: string
  awayAbbr: string
}

export interface SurvivorAdminRow {
  userId: number
  displayName: string
  enrolled: boolean
  alive: boolean | null
  eliminatedWeek: number | null
}

export interface WeekStatusRow {
  userId: number
  displayName: string
  /** Pick 3 picks in for the current week (0–3). */
  pick3Count: number
  survivor: 'not-enrolled' | 'eliminated' | 'picked' | 'missing'
}

export function AdminPanels({
  users,
  flagged,
  survivorRows,
  survivorSeason,
  weekStatus,
}: {
  users: UserRow[]
  flagged: FlaggedGame[]
  survivorRows: SurvivorAdminRow[]
  survivorSeason: number | null
  weekStatus: { week: number | null; rows: WeekStatusRow[] }
}) {
  return (
    <div className="flex flex-col gap-6">
      <SyncPanel />
      {flagged.length > 0 && <FlaggedPanel flagged={flagged} />}
      {weekStatus.week !== null && <WeekStatusPanel week={weekStatus.week} rows={weekStatus.rows} />}
      <UsersPanel users={users} />
      <SurvivorPanel rows={survivorRows} season={survivorSeason} />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="ff-display mb-4 text-2xl text-primary">{title}</h2>
      {children}
    </section>
  )
}

function Feedback({ state }: { state: AdminResult }) {
  if (state.error) return <p className="mt-3 text-sm font-semibold text-danger">{state.error}</p>
  if (state.info) return <p className="mt-3 text-sm font-semibold text-success">{state.info}</p>
  return null
}

function SyncPanel() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<AdminResult>({})
  return (
    <Panel title="ESPN Sync">
      <p className="mb-3 text-sm text-muted">
        The cron job runs this automatically. Trigger a pass manually after adding users or
        if scores look stale.
      </p>
      <button
        onClick={() => startTransition(async () => setResult(await runSyncNow()))}
        disabled={pending}
        className="cursor-pointer rounded-lg bg-secondary px-5 py-2.5 text-sm font-bold uppercase tracking-wider hover:brightness-125 disabled:opacity-50"
      >
        {pending ? 'Syncing…' : 'Run sync now'}
      </button>
      <Feedback state={result} />
    </Panel>
  )
}

/** Who still owes picks this week — the nudge list, incomplete players first. */
function WeekStatusPanel({ week, rows }: { week: number; rows: WeekStatusRow[] }) {
  const owes = (r: WeekStatusRow) => r.pick3Count < 3 || r.survivor === 'missing'
  const sorted = [...rows].sort((a, b) => {
    if (owes(a) !== owes(b)) return owes(a) ? -1 : 1
    return a.pick3Count - b.pick3Count || a.displayName.localeCompare(b.displayName)
  })
  const owing = rows.filter(owes).length
  const survivorLabel: Record<WeekStatusRow['survivor'], string> = {
    'not-enrolled': '—',
    eliminated: 'OUT',
    picked: 'IN',
    missing: 'NO PICK',
  }
  const survivorColor: Record<WeekStatusRow['survivor'], string> = {
    'not-enrolled': 'text-muted',
    eliminated: 'text-muted',
    picked: 'text-success',
    missing: 'text-danger',
  }
  return (
    <Panel title={`Week ${week} Pick Status`}>
      <p className="mb-4 text-sm text-muted">
        {owing === 0
          ? 'Everyone is in for the week.'
          : `${owing} player${owing === 1 ? '' : 's'} still owe${owing === 1 ? 's' : ''} a pick.`}{' '}
        Survivor shows IN once a pick is in (the team is hidden until kickoff, same as for players).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
              <th className="pb-2 pr-4">Player</th>
              <th className="pb-2 pr-4">Pick 3</th>
              <th className="pb-2">Survivor</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.userId} className={`border-t border-line ${owes(r) ? '' : 'opacity-60'}`}>
                <td className="py-2 pr-4 font-semibold">{r.displayName}</td>
                <td className="py-2 pr-4">
                  <span className="mr-2 inline-flex gap-1" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${i < r.pick3Count ? 'bg-success' : 'bg-line'}`}
                      />
                    ))}
                  </span>
                  <span className={`font-bold tabular-nums ${r.pick3Count < 3 ? 'text-warning' : 'text-success'}`}>
                    {r.pick3Count}/3
                  </span>
                </td>
                <td className={`py-2 font-bold ${survivorColor[r.survivor]}`}>{survivorLabel[r.survivor]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function FlaggedPanel({ flagged }: { flagged: FlaggedGame[] }) {
  return (
    <Panel title="⚠ Needs Review">
      <p className="mb-4 text-sm text-muted">
        These games went final but ESPN&rsquo;s score looked wrong or incomplete. Confirm the
        real final score to grade picks, or void the picks entirely.
      </p>
      <div className="flex flex-col gap-4">
        {flagged.map((g) => (
          <FlaggedRow key={g.id} game={g} />
        ))}
      </div>
    </Panel>
  )
}

function FlaggedRow({ game }: { game: FlaggedGame }) {
  const [resolveState, resolveAction, resolvePending] = useActionState(resolveFlaggedGame, {})
  const [voidState, voidAction, voidPending] = useActionState(voidGamePicks, {})
  return (
    <div className="rounded-lg bg-surface-light p-4">
      <div className="font-semibold">{game.label}</div>
      <div className="mb-3 text-sm text-muted">{game.detail}</div>
      <form action={resolveAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="gameId" value={game.id} />
        <label className="text-sm font-semibold">{game.awayAbbr}</label>
        <input
          name="awayScore"
          type="number"
          min={0}
          required
          className="w-20 rounded-lg border-2 border-line bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <label className="text-sm font-semibold">{game.homeAbbr}</label>
        <input
          name="homeScore"
          type="number"
          min={0}
          required
          className="w-20 rounded-lg border-2 border-line bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={resolvePending}
          className="cursor-pointer rounded-lg bg-success px-4 py-2 text-sm font-bold uppercase disabled:opacity-50"
        >
          Confirm &amp; grade
        </button>
      </form>
      <form action={voidAction} className="mt-2">
        <input type="hidden" name="gameId" value={game.id} />
        <button
          type="submit"
          disabled={voidPending}
          className="cursor-pointer rounded-lg border border-danger px-4 py-2 text-sm font-bold uppercase text-danger disabled:opacity-50"
        >
          Void picks on this game
        </button>
      </form>
      <Feedback state={resolveState.error || resolveState.info ? resolveState : voidState} />
    </div>
  )
}

function UsersPanel({ users }: { users: UserRow[] }) {
  const [state, action, pending] = useActionState(addUser, {})
  return (
    <Panel title="Players">
      <form action={action} className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Email</label>
          <input
            name="email"
            type="email"
            required
            className="rounded-lg border-2 border-line bg-surface-light px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Display name</label>
          <input
            name="displayName"
            type="text"
            required
            className="rounded-lg border-2 border-line bg-surface-light px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-bold uppercase tracking-wider hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add player'}
        </button>
      </form>
      <Feedback state={state} />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Name</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Email</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Role</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Last seen</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Emails</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <PlayerRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function PlayerRow({ user }: { user: UserRow }) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState(renamePlayer, {})
  const [emailState, emailAction, emailPending] = useActionState(toggleEmailPref, {})
  const [testState, testAction, testPending] = useActionState(sendTestEmail, {})
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-3 py-2 font-semibold">
        {editing ? (
          <form
            action={action}
            className="flex flex-wrap items-center gap-2"
            onSubmit={() => setEditing(false)}
          >
            <input type="hidden" name="userId" value={user.id} />
            <input
              name="displayName"
              type="text"
              defaultValue={user.displayName}
              required
              autoFocus
              className="w-36 rounded-lg border-2 border-line bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-lg bg-success px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-bold uppercase text-muted hover:border-danger hover:text-danger"
            >
              Cancel
            </button>
          </form>
        ) : (
          <span className="flex items-center gap-2">
            {user.displayName}
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              title="Rename player"
              className="cursor-pointer rounded border border-line px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted hover:border-primary hover:text-primary disabled:opacity-50"
            >
              ✎ Rename
            </button>
          </span>
        )}
        <Feedback state={state} />
      </td>
      <td className="px-3 py-2 text-muted">{user.email}</td>
      <td className="px-3 py-2">{user.isAdmin ? <span className="font-bold text-primary">Admin</span> : 'Player'}</td>
      <td className="whitespace-nowrap px-3 py-2 text-muted">{user.lastSeen ?? 'Never'}</td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-2">
          <form action={emailAction} className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="pref" value="reminders" />
            <button
              type="submit"
              disabled={emailPending}
              title="Toggle pick-reminder emails for this player"
              className={`cursor-pointer rounded border px-2 py-0.5 text-xs font-bold uppercase disabled:opacity-50 ${
                user.emailReminders
                  ? 'border-success text-success'
                  : 'border-line text-muted hover:border-primary'
              }`}
            >
              Rem
            </button>
          </form>
          <form action={emailAction} className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="pref" value="recaps" />
            <button
              type="submit"
              disabled={emailPending}
              title="Toggle weekly-recap emails for this player"
              className={`cursor-pointer rounded border px-2 py-0.5 text-xs font-bold uppercase disabled:opacity-50 ${
                user.emailRecaps
                  ? 'border-success text-success'
                  : 'border-line text-muted hover:border-primary'
              }`}
            >
              Recap
            </button>
          </form>
          <form action={testAction} className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <button
              type="submit"
              disabled={testPending}
              title="Send a test email to this player (works even when their emails are off)"
              className="cursor-pointer rounded border border-line px-2 py-0.5 text-xs font-bold uppercase text-muted hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {testPending ? 'Sending…' : '✉ Test'}
            </button>
          </form>
        </span>
        <Feedback state={emailState} />
        <Feedback state={testState} />
      </td>
      <td className="px-3 py-2 text-right">
        {!user.isAdmin && !user.isSelf && <RemovePlayerButton user={user} />}
      </td>
    </tr>
  )
}

/** Two-step remove: the first click reveals what will be deleted; the second commits. */
function RemovePlayerButton({ user }: { user: UserRow }) {
  const [confirming, setConfirming] = useState(false)
  const [state, action, pending] = useActionState(removePlayer, {})
  if (!confirming) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title="Remove this player and all their picks"
          className="cursor-pointer rounded border border-line px-2 py-0.5 text-xs font-bold uppercase text-muted hover:border-danger hover:text-danger"
        >
          Remove
        </button>
        <Feedback state={state} />
      </>
    )
  }
  const what = [
    user.pickCount > 0 && `${user.pickCount} pick${user.pickCount === 1 ? '' : 's'}`,
    user.survivorPickCount > 0 &&
      `${user.survivorPickCount} survivor pick${user.survivorPickCount === 1 ? '' : 's'}`,
  ].filter(Boolean)
  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="userId" value={user.id} />
      <span className="whitespace-nowrap text-xs text-danger">
        Delete {user.displayName}
        {what.length > 0 ? ` and their ${what.join(' + ')}` : ''}? This can&rsquo;t be undone.
      </span>
      <span className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-danger px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50"
        >
          {pending ? 'Removing…' : 'Yes, remove'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-bold uppercase text-muted hover:text-ink"
        >
          Cancel
        </button>
      </span>
      <Feedback state={state} />
    </form>
  )
}

function SurvivorPanel({ rows, season }: { rows: SurvivorAdminRow[]; season: number | null }) {
  if (season === null) {
    return (
      <Panel title="Survivor Pool">
        <p className="text-sm text-muted">Run a sync first — enrollment opens once the season exists.</p>
      </Panel>
    )
  }
  return (
    <Panel title={`Survivor Pool · ${season}`}>
      <p className="mb-4 text-sm text-muted">
        Enroll players before week 1. A player enrolled late is charged for every week
        already past. Unenrolling is only possible while they have no picks.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Name</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Status</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <SurvivorAdminRowView key={r.userId} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function SurvivorAdminRowView({ row }: { row: SurvivorAdminRow }) {
  const [enrollState, enrollAction, enrollPending] = useActionState(enrollSurvivorPlayer, {})
  const [unenrollState, unenrollAction, unenrollPending] = useActionState(unenrollSurvivorPlayer, {})
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-3 py-2 font-semibold">{row.displayName}</td>
      <td className="px-3 py-2">
        {!row.enrolled ? (
          <span className="text-muted">—</span>
        ) : row.alive ? (
          <span className="rounded bg-success/20 px-2 py-0.5 text-xs font-bold uppercase text-success">Alive</span>
        ) : (
          <span className="rounded bg-danger/20 px-2 py-0.5 text-xs font-bold uppercase text-danger">
            Out Wk {row.eliminatedWeek}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <form action={row.enrolled ? unenrollAction : enrollAction} className="inline">
          <input type="hidden" name="userId" value={row.userId} />
          <button
            type="submit"
            disabled={enrollPending || unenrollPending}
            className={`cursor-pointer rounded-lg border px-3 py-1 text-xs font-bold uppercase disabled:opacity-50 ${
              row.enrolled
                ? 'border-danger text-danger hover:bg-danger/10'
                : 'border-success text-success hover:bg-success/10'
            }`}
          >
            {row.enrolled ? 'Unenroll' : 'Enroll'}
          </button>
        </form>
        <Feedback state={enrollState.error || enrollState.info ? enrollState : unenrollState} />
      </td>
    </tr>
  )
}
