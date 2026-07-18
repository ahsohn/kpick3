'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removePick, submitPicks } from '@/app/actions/picks'
import { formatSpread } from '@/lib/format'
import type { BoardGame } from './board-types'

interface ExistingPick {
  gameId: number
  side: 'home' | 'away'
  lockedSpread: number
}

const MAX = 3

function titleDay(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase()
}

function gameStarted(game: BoardGame, now: number): boolean {
  return new Date(game.kickoffIso).getTime() <= now || game.statusState !== 'pre'
}

/** Sportsbook board: compact game rows + pick slip (rail on desktop, sheet on mobile). */
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
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const byGame = useMemo(() => new Map(games.map((g) => [g.id, g])), [games])
  const remaining = MAX - existingPicks.length
  const now = Date.now()

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
        setMessage({ kind: 'success', text: 'Picks locked in — your spread is saved.' })
        setSelected(new Map())
        setSheetExpanded(false)
        router.refresh()
      }
    })
  }

  function removeLocked(gameId: number) {
    if (!window.confirm('Remove this pick? If you re-pick this game later, it locks at the spread current at that time.')) {
      return
    }
    startTransition(async () => {
      const result = await removePick(gameId)
      if (result.error) {
        setMessage({ kind: 'error', text: result.error })
      } else {
        setMessage({ kind: 'success', text: 'Pick removed.' })
        router.refresh()
      }
    })
  }

  function chipContent(game: BoardGame, side: 'home' | 'away') {
    const myPick = existingPicks.find((p) => p.gameId === game.id)
    if (myPick?.side === side) return `✓ ${formatSpread(myPick.lockedSpread)}`
    if (game.homeSpread === null) return '—'
    return formatSpread(side === 'home' ? game.homeSpread : -game.homeSpread)
  }

  function Chip({ game, side, mobile }: { game: BoardGame; side: 'home' | 'away'; mobile?: boolean }) {
    const started = gameStarted(game, now)
    const myPick = existingPicks.find((p) => p.gameId === game.id)
    const isMyPick = myPick?.side === side
    const isSelected = selected.get(game.id) === side
    const noLine = game.homeSpread === null
    const selectable =
      !started && !game.canceled && !noLine && !myPick && remaining > 0 &&
      (isSelected || selected.has(game.id) || selected.size < remaining)

    const size = mobile
      ? 'ml-auto min-w-16 h-11 rounded-[9px]'
      : 'h-8 rounded-lg'
    let look: string
    if (isMyPick) {
      look = 'border-green bg-green/10 text-green font-bold'
    } else if (isSelected) {
      look = 'border-accent bg-accent/12 text-accent-text font-extrabold cursor-pointer'
    } else if (selectable) {
      look = 'border-control bg-surface-3 font-bold cursor-pointer hover:border-accent'
    } else {
      look = 'border-control bg-surface-3 text-muted font-bold opacity-45'
    }

    return (
      <button
        type="button"
        disabled={!selectable && !isSelected}
        onClick={() => (selectable || isSelected) && toggle(game, side)}
        className={`flex items-center justify-center gap-1.5 border text-[13px] tabular-nums transition-colors ${size} ${look}`}
      >
        {chipContent(game, side)}
      </button>
    )
  }

  function StatusCell({ game }: { game: BoardGame }) {
    if (game.statusState === 'in') {
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="live-dot h-[7px] w-[7px] rounded-full bg-accent" />
            <span className="text-[11px] font-extrabold tracking-[.1em] text-accent">LIVE</span>
          </div>
          <div className="text-[13px] font-bold tabular-nums text-ink-2">{game.statusDetail}</div>
        </div>
      )
    }
    const second = game.canceled
      ? 'CANCELED'
      : game.completed
        ? 'FINAL'
        : gameStarted(game, now)
          ? 'STARTED'
          : game.kickoffTime
    return (
      <div>
        <div className="text-[11px] font-bold tracking-[.1em] text-muted">{game.kickoffDay}</div>
        <div className="text-[13px] font-bold text-ink-2">{second}</div>
      </div>
    )
  }

  function TeamLine({ game, side, mobile }: { game: BoardGame; side: 'home' | 'away'; mobile?: boolean }) {
    const started = gameStarted(game, now)
    const abbr = side === 'away' ? game.awayTeamAbbr : game.homeTeamAbbr
    const name = side === 'away' ? game.awayTeamName : game.homeTeamName
    const score = side === 'away' ? game.awayScore : game.homeScore
    return (
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-tile text-[10px] font-extrabold">
          {abbr}
        </span>
        <span className="text-sm font-semibold">{name}</span>
        {started && score !== null && (
          <span className="ml-auto text-[15px] font-extrabold tabular-nums">{score}</span>
        )}
        {mobile && <span className={started && score !== null ? 'ml-3' : 'ml-auto'}><Chip game={game} side={side} mobile /></span>}
      </div>
    )
  }

  function rowLook(game: BoardGame): string {
    if (selected.has(game.id)) return 'border-[#3a2026] bg-[#141019]'
    return 'border-card bg-surface'
  }

  // --- slip entries -------------------------------------------------------
  const lockedEntries = existingPicks
    .map((p) => {
      const game = byGame.get(p.gameId)
      if (!game) return null
      const teamName = p.side === 'home' ? game.homeTeamName : game.awayTeamName
      const opp = p.side === 'home' ? `vs ${game.awayTeamName}` : `at ${game.homeTeamName}`
      return {
        gameId: p.gameId,
        title: `${teamName} ${formatSpread(p.lockedSpread)}`,
        detail: `${opp} · ${titleDay(game.kickoffDay)} ${game.kickoffTime}`,
        removable: !gameStarted(game, now) && !game.canceled,
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  const pendingEntries = [...selected.entries()].map(([gameId, side]) => {
    const game = byGame.get(gameId)!
    const teamName = side === 'home' ? game.homeTeamName : game.awayTeamName
    const opp = side === 'home' ? `vs ${game.awayTeamName}` : `at ${game.homeTeamName}`
    const spread = game.homeSpread === null ? null : side === 'home' ? game.homeSpread : -game.homeSpread
    return {
      gameId,
      side,
      title: `${teamName} ${formatSpread(spread)}`,
      detail: `${opp} · ${titleDay(game.kickoffDay)} ${game.kickoffTime}`,
    }
  })

  const emptySlots = Math.max(0, MAX - lockedEntries.length - pendingEntries.length)

  function SlipEntries() {
    return (
      <div className="flex flex-col gap-2">
        {lockedEntries.map((e) => (
          <div
            key={e.gameId}
            className="flex items-center justify-between rounded-[10px] border border-green bg-green/7 px-3 py-2.5"
          >
            <div>
              <div className="text-[13px] font-bold">{e.title}</div>
              <div className="text-[11px] text-muted">{e.detail}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-[5px] border border-green/40 px-1.5 py-0.5 text-[10px] font-extrabold tracking-[.08em] text-green">
                LOCKED
              </span>
              {e.removable && (
                <button
                  type="button"
                  onClick={() => removeLocked(e.gameId)}
                  disabled={pending}
                  className="cursor-pointer text-sm text-muted hover:text-accent"
                  aria-label="Remove pick"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        {pendingEntries.map((e) => (
          <div
            key={e.gameId}
            className="flex items-center justify-between rounded-[10px] border border-accent bg-accent/7 px-3 py-2.5"
          >
            <div>
              <div className="text-[13px] font-bold">{e.title}</div>
              <div className="text-[11px] text-muted">{e.detail}</div>
            </div>
            <button
              type="button"
              onClick={() => toggle(byGame.get(e.gameId)!, e.side)}
              className="cursor-pointer text-sm text-muted hover:text-ink"
              aria-label="Deselect"
            >
              ✕
            </button>
          </div>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div
            key={`empty-${i}`}
            className="rounded-[10px] border border-dashed border-strong p-3 text-center text-xs text-muted"
          >
            Pick 3 · choose any open game
          </div>
        ))}
      </div>
    )
  }

  function SlipBody() {
    return (
      <>
        <SlipEntries />
        {message && (
          <p
            className={`mt-3 text-center text-xs font-semibold ${
              message.kind === 'success' ? 'text-green' : 'text-accent'
            }`}
          >
            {message.text}
          </p>
        )}
        {remaining > 0 && (
          <button
            type="button"
            onClick={submit}
            disabled={pending || selected.size === 0}
            className="mt-3.5 w-full cursor-pointer rounded-[10px] bg-accent p-[13px] text-center text-sm font-extrabold tracking-[.06em] text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50"
          >
            {pending
              ? 'SUBMITTING…'
              : selected.size === 0
                ? 'SELECT PICKS'
                : `SUBMIT ${selected.size} PICK${selected.size > 1 ? 'S' : ''}`}
          </button>
        )}
        <p className="mb-0 mt-2.5 text-center text-[11px] leading-relaxed text-muted">
          {remaining > 0
            ? 'Your spread is saved the moment you submit — line moves after that don’t touch you.'
            : 'All 3 picks are in for this week.'}
        </p>
      </>
    )
  }

  const peekSummary =
    pendingEntries.length > 0
      ? `${pendingEntries[0].title}${pendingEntries.length > 1 ? ` +${pendingEntries.length - 1}` : ''} not submitted`
      : remaining <= 0
        ? 'All 3 picks locked'
        : `${remaining - pendingEntries.length} slot${remaining - pendingEntries.length === 1 ? '' : 's'} open`

  return (
    <div className="grid gap-6 px-7 pb-8 pt-6 max-lg:px-3.5 max-lg:pb-40 lg:grid-cols-[1fr_320px]">
      {/* game rows */}
      <div className="flex flex-col gap-2.5">
        {games.map((game) => {
          const finished = game.completed || game.canceled
          const live = game.statusState === 'in'
          const myPick = existingPicks.find((p) => p.gameId === game.id)
          return (
            <div key={game.id}>
              {/* desktop row */}
              <div
                className={`hidden grid-cols-[96px_1fr_128px] items-center gap-4 rounded-xl border px-[18px] py-3.5 lg:grid ${rowLook(game)} ${finished ? 'opacity-55' : ''}`}
              >
                <StatusCell game={game} />
                <div className="flex flex-col gap-2">
                  <TeamLine game={game} side="away" />
                  <TeamLine game={game} side="home" />
                </div>
                <div className={`flex flex-col gap-2 ${live ? 'opacity-45' : ''}`}>
                  <Chip game={game} side="away" />
                  <Chip game={game} side="home" />
                </div>
              </div>

              {/* mobile card */}
              <div
                className={`rounded-xl border px-3.5 py-3 lg:hidden ${rowLook(game)} ${finished ? 'opacity-55' : ''}`}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  {live ? (
                    <span className="flex items-center gap-1.5">
                      <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="text-[11px] font-extrabold tracking-[.1em] text-accent">
                        LIVE · {game.statusDetail}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold tracking-[.1em] text-muted">
                      {game.kickoffDay} ·{' '}
                      {game.canceled
                        ? 'CANCELED'
                        : game.completed
                          ? 'FINAL'
                          : gameStarted(game, now)
                            ? 'STARTED'
                            : game.kickoffTime}
                    </span>
                  )}
                  {myPick && !finished && (
                    <span className="rounded-[5px] border border-green/40 px-1.5 py-0.5 text-[10px] font-extrabold tracking-[.08em] text-green">
                      PICK IN
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <TeamLine game={game} side="away" mobile />
                  <TeamLine game={game} side="home" mobile />
                </div>
              </div>
            </div>
          )
        })}
        {games.length === 0 && (
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            No games this week.
          </p>
        )}
      </div>

      {/* desktop slip rail */}
      <aside className="sticky top-4 hidden h-fit rounded-[14px] border border-control bg-surface p-[18px] lg:block">
        <div className="mb-3.5 flex items-baseline justify-between">
          <span className="text-sm font-extrabold tracking-[.08em]">PICK SLIP</span>
          <span className="text-xs font-bold text-muted">
            <span className="text-green">{lockedEntries.length}</span>/3 locked
          </span>
        </div>
        <SlipBody />
      </aside>

      {/* mobile bottom sheet */}
      {sheetExpanded && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(8,10,15,.4)] backdrop-blur-[1.5px] lg:hidden"
          onClick={() => setSheetExpanded(false)}
        />
      )}
      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-strong bg-surface-2 px-4 pb-6 pt-2.5 shadow-[0_-8px_24px_rgba(0,0,0,.5)] lg:hidden">
        <button
          type="button"
          aria-label={sheetExpanded ? 'Collapse pick slip' : 'Expand pick slip'}
          onClick={() => setSheetExpanded((v) => !v)}
          className="mx-auto mb-2.5 block h-1 w-9 cursor-pointer rounded-sm bg-strong"
        />
        {sheetExpanded ? (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm font-extrabold tracking-[.08em]">PICK SLIP</span>
              <span className="text-xs font-bold text-muted">
                <span className="text-green">{lockedEntries.length}</span>/3 locked
              </span>
            </div>
            <SlipBody />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="cursor-pointer text-left" onClick={() => setSheetExpanded(true)}>
              <div className="text-[13px] font-extrabold tracking-[.06em]">
                PICK SLIP · <span className="text-green">{lockedEntries.length}</span>/3
              </div>
              <div className="text-[11px] text-muted">{peekSummary}</div>
            </button>
            {remaining > 0 && (
              <button
                type="button"
                onClick={submit}
                disabled={pending || selected.size === 0}
                className="cursor-pointer rounded-[9px] bg-accent px-5 py-3 text-[13px] font-extrabold tracking-[.05em] text-white disabled:opacity-50"
              >
                {pending ? '…' : `SUBMIT ${selected.size}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
