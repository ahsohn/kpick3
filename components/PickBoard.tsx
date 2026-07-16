'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitPicks } from '@/app/actions/picks'
import { formatSpread } from '@/lib/format'
import type { BoardGame } from './board-types'

interface ExistingPick {
  gameId: number
  side: 'home' | 'away'
  lockedSpread: number
}

export function PickBoard({
  games,
  existingPicks,
}: {
  games: BoardGame[]
  existingPicks: ExistingPick[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Map<number, 'home' | 'away'>>(new Map())
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const pickedGameIds = useMemo(() => new Set(existingPicks.map((p) => p.gameId)), [existingPicks])
  const remaining = 3 - existingPicks.length

  function toggle(game: BoardGame, side: 'home' | 'away') {
    if (pending) return
    setMessage(null)
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.get(game.id) === side) {
        next.delete(game.id)
      } else if (next.has(game.id) || next.size < remaining) {
        next.set(game.id, side)
      }
      return next
    })
  }

  function submit() {
    const input = [...selected.entries()].map(([gameId, side]) => ({ gameId, side }))
    startTransition(async () => {
      const result = await submitPicks(input)
      if (result.error) {
        setMessage({ kind: 'error', text: result.error })
      } else {
        setMessage({ kind: 'success', text: 'Picks locked in! Your spread is saved with each pick.' })
        setSelected(new Map())
        router.refresh()
      }
    })
  }

  const now = Date.now()

  return (
    <div>
      {message && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-center font-semibold ${
            message.kind === 'success'
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-4 text-center text-sm text-muted">
        <strong className="text-ink">
          {remaining <= 0
            ? 'All 3 picks in for this week'
            : `Selected ${selected.size} of ${remaining} remaining pick${remaining > 1 ? 's' : ''}`}
        </strong>
        {remaining > 0 && <span> · spreads lock at the moment you submit</span>}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => {
          const started = new Date(game.kickoffIso).getTime() <= now || game.statusState !== 'pre'
          const myPick = existingPicks.find((p) => p.gameId === game.id)
          const noLine = game.homeSpread === null
          const locked = started || Boolean(myPick) || game.canceled || noLine || remaining <= 0

          return (
            <div
              key={game.id}
              className="relative rounded-xl border-2 border-line bg-surface p-5 transition-colors hover:border-primary/60"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  {game.statusState === 'in' && game.statusDetail ? game.statusDetail : game.kickoffLabel}
                </span>
                {game.canceled ? (
                  <Badge tone="danger">Canceled</Badge>
                ) : started ? (
                  <Badge tone="danger">{game.statusState === 'in' ? 'Live' : game.completed ? 'Final' : 'Started'}</Badge>
                ) : myPick ? (
                  <Badge tone="success">Pick in</Badge>
                ) : noLine ? (
                  <Badge tone="warning">No line yet</Badge>
                ) : null}
              </div>

              {(['away', 'home'] as const).map((side) => {
                const isSelected = selected.get(game.id) === side
                const isMyPick = myPick?.side === side
                const spread =
                  isMyPick && myPick
                    ? myPick.lockedSpread
                    : game.homeSpread === null
                      ? null
                      : side === 'home'
                        ? game.homeSpread
                        : -game.homeSpread
                return (
                  <button
                    key={side}
                    type="button"
                    disabled={locked && !isMyPick}
                    onClick={() => !locked && toggle(game, side)}
                    className={`mb-2 flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-all last:mb-0 ${
                      isSelected || isMyPick
                        ? 'border-primary bg-primary/20'
                        : 'border-transparent bg-surface-light'
                    } ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/40 hover:bg-primary/10'} ${
                      isMyPick ? '!opacity-100' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {side === 'away' ? game.awayTeamName : game.homeTeamName}
                      {isMyPick && <span className="text-xs font-bold uppercase text-success">your pick</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      {started && (side === 'away' ? game.awayScore : game.homeScore) !== null && (
                        <span className="text-lg font-bold tabular-nums">
                          {side === 'away' ? game.awayScore : game.homeScore}
                        </span>
                      )}
                      <span className="font-bold text-primary">
                        {formatSpread(spread)}
                        {isMyPick && <span className="ml-1 text-[10px] uppercase text-muted">locked</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {remaining > 0 && (
        <button
          onClick={submit}
          disabled={pending || selected.size === 0}
          className="ff-display mx-auto mt-8 block w-full max-w-sm cursor-pointer rounded-xl py-4 text-2xl tracking-widest transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            boxShadow: '0 4px 16px rgba(213,10,10,.3)',
          }}
        >
          {pending
            ? 'Submitting…'
            : selected.size === 0
              ? 'Select picks'
              : `Submit ${selected.size} pick${selected.size > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}

function Badge({ tone, children }: { tone: 'success' | 'danger' | 'warning'; children: React.ReactNode }) {
  const classes = {
    success: 'bg-success/20 text-success',
    danger: 'bg-danger/20 text-danger',
    warning: 'bg-warning/20 text-warning',
  }[tone]
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${classes}`}>
      {children}
    </span>
  )
}
