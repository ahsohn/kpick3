'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  addUser,
  enrollSurvivorPlayer,
  renamePlayer,
  resolveFlaggedGame,
  runSyncNow,
  unenrollSurvivorPlayer,
  voidGamePicks,
  type AdminResult,
} from './actions'

interface UserRow {
  id: number
  email: string
  displayName: string
  isAdmin: boolean
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

export function AdminPanels({
  users,
  flagged,
  survivorRows,
  survivorSeason,
}: {
  users: UserRow[]
  flagged: FlaggedGame[]
  survivorRows: SurvivorAdminRow[]
  survivorSeason: number | null
}) {
  return (
    <div className="flex flex-col gap-6">
      <SyncPanel />
      {flagged.length > 0 && <FlaggedPanel flagged={flagged} />}
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
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Name</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Email</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-wider">Role</th>
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
    </tr>
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
        <table className="w-full min-w-[420px] border-collapse text-sm">
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
