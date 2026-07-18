'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeSurvivorPick, submitSurvivorPick } from '@/app/actions/survivor'
import type { BoardGame } from './board-types'

export interface MySurvivorPick {
  gameId: number
  side: 'home' | 'away'
  teamAbbr: string
}

export interface UsedTeam {
  abbr: string
  week: number
}

function titleDay(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase()
}

function gameStarted(game: BoardGame, now: number): boolean {
  return new Date(game.kickoffIso).getTime() <= now || game.statusState !== 'pre'
}

/**
 * Survivor mode board: game cards with straight-up team buttons + the survivor slip
 * (rail on desktop, bottom sheet on mobile) and the teams-used card.
 */
export function SurvivorPickPanel({
  games,
  usedTeams,
  myPick,
  week,
  aliveCount,
  entryCount,
}: {
  games: BoardGame[]
  usedTeams: UsedTeam[]
  myPick: MySurvivorPick | null
  week: number
  aliveCount: number
  entryCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<{ gameId: number; side: 'home' | 'away' } | null>(null)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const usedByAbbr = new Map(usedTeams.map((t) => [t.abbr, t.week]))
  const now = Date.now()

  function submit() {
    if (!selected) return
    startTransition(async () => {
      const result = await submitSurvivorPick(selected)
      if (result.error) {
        setMessage({ kind: 'error', text: result.error })
      } else {
        setMessage({ kind: 'success', text: 'Survivor pick in! You can change it until your game kicks off.' })
        setSelected(null)
        setSheetExpanded(false)
        router.refresh()
      }
    })
  }

  function remove() {
    if (!window.confirm('Remove your survivor pick? Don’t forget to pick again before kickoff.')) return
    startTransition(async () => {
      const result = await removeSurvivorPick()
      if (result.error) {
        setMessage({ kind: 'error', text: result.error })
      } else {
        setMessage({ kind: 'success', text: 'Pick removed — don’t forget to pick again before kickoff.' })
        router.refresh()
      }
    })
  }

  function TeamButton({ game, side }: { game: BoardGame; side: 'home' | 'away' }) {
    const abbr = side === 'away' ? game.awayTeamAbbr : game.homeTeamAbbr
    const name = side === 'away' ? game.awayTeamName : game.homeTeamName
    const score = side === 'away' ? game.awayScore : game.homeScore
    const started = gameStarted(game, now)
    const usedWeek = usedByAbbr.get(abbr)
    const isMyPick = myPick?.gameId === game.id && myPick.side === side
    const isUsed = usedWeek !== undefined && !isMyPick
    const isSelected = selected?.gameId === game.id && selected.side === side
    const disabled = started || game.canceled || isUsed

    let look = 'border-control bg-surface-3'
    if (isSelected) look = 'border-amber bg-amber/12'
    else if (isMyPick) look = 'border-green bg-green/10'
    else if (!disabled) look = 'border-control bg-surface-3 cursor-pointer hover:border-amber'

    return (
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          if (disabled) return
          setMessage(null)
          setSelected(isSelected ? null : { gameId: game.id, side })
        }}
        className={`flex w-full items-center gap-2.5 rounded-[9px] border px-3 py-2 text-left transition-colors ${look} ${isUsed ? 'opacity-50' : ''}`}
      >
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-tile text-[9px] font-extrabold">
          {abbr}
        </span>
        <span className={`text-sm ${isSelected || isMyPick ? 'font-bold' : 'font-semibold'}`}>{name}</span>
        {isSelected && (
          <span className="ml-auto text-[10px] font-extrabold tracking-[.08em] text-amber">SELECTED</span>
        )}
        {isMyPick && !isSelected && (
          <span className="ml-auto text-[10px] font-extrabold tracking-[.08em] text-green">YOUR PICK</span>
        )}
        {isUsed && (
          <span className="ml-auto whitespace-nowrap rounded-[4px] border border-strong px-1.5 py-0.5 text-[9px] font-extrabold tracking-[.1em] text-muted">
            USED W{usedWeek}
          </span>
        )}
        {!isSelected && !isMyPick && !isUsed && started && score !== null && (
          <span className="ml-auto text-[15px] font-extrabold tabular-nums">{score}</span>
        )}
      </button>
    )
  }

  // --- slip contents ------------------------------------------------------
  const selectedGame = selected ? games.find((g) => g.id === selected.gameId) : null
  const myPickGame = myPick ? games.find((g) => g.id === myPick.gameId) : null

  const entry = selectedGame
    ? {
        title: `${selected!.side === 'home' ? selectedGame.homeTeamName : selectedGame.awayTeamName} to win`,
        detail: `${selected!.side === 'home' ? `vs ${selectedGame.awayTeamName}` : `at ${selectedGame.homeTeamName}`} · ${titleDay(selectedGame.kickoffDay)} ${selectedGame.kickoffTime}`,
        kind: 'pending' as const,
      }
    : myPick && myPickGame
      ? {
          title: `${myPick.side === 'home' ? myPickGame.homeTeamName : myPickGame.awayTeamName} to win`,
          detail: `${myPick.side === 'home' ? `vs ${myPickGame.awayTeamName}` : `at ${myPickGame.homeTeamName}`} · ${titleDay(myPickGame.kickoffDay)} ${myPickGame.kickoffTime}`,
          kind: 'locked' as const,
          removable: !gameStarted(myPickGame, now) && !myPickGame.canceled,
        }
      : null

  const footnote =
    entry?.kind === 'locked' && myPickGame
      ? entry.removable
        ? `Change or remove until the ${myPick!.side === 'home' ? myPickGame.homeTeamName : myPickGame.awayTeamName} game kicks off ${titleDay(myPickGame.kickoffDay)}.`
        : 'Your pick is locked — its game already kicked off.'
      : 'One team to win straight-up · locks at that game’s kickoff.'

  function SlipBody() {
    return (
      <>
        {entry ? (
          <div
            className={`flex items-center justify-between rounded-[10px] border px-3 py-2.5 ${
              entry.kind === 'pending' ? 'border-amber bg-amber/7' : 'border-green bg-green/7'
            }`}
          >
            <div>
              <div className="text-[13px] font-bold">{entry.title}</div>
              <div className="text-[11px] text-muted">{entry.detail}</div>
            </div>
            {entry.kind === 'pending' ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="cursor-pointer text-sm text-muted hover:text-ink"
                aria-label="Deselect"
              >
                ✕
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="rounded-[5px] border border-green/40 px-1.5 py-0.5 text-[10px] font-extrabold tracking-[.08em] text-green">
                  IN
                </span>
                {entry.removable && (
                  <button
                    type="button"
                    onClick={remove}
                    disabled={pending}
                    className="cursor-pointer text-sm text-muted hover:text-accent"
                    aria-label="Remove pick"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-strong p-3 text-center text-xs text-muted">
            No pick yet — choose a team to win
          </div>
        )}
        {message && (
          <p
            className={`mt-3 text-center text-xs font-semibold ${
              message.kind === 'success' ? 'text-green' : 'text-accent'
            }`}
          >
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || !selected}
          className="mt-3.5 w-full cursor-pointer rounded-[10px] bg-amber p-[13px] text-center text-sm font-extrabold tracking-[.06em] text-amber-ink transition-colors hover:bg-amber-hover disabled:cursor-default disabled:opacity-50"
        >
          {pending ? 'SAVING…' : myPick ? 'CHANGE SURVIVOR PICK' : 'SUBMIT SURVIVOR PICK'}
        </button>
        <p className="mb-0 mt-2.5 text-center text-[11px] leading-relaxed text-muted">{footnote}</p>
      </>
    )
  }

  const slipHeader = (
    <div className="mb-3.5 flex items-baseline justify-between">
      <span className="text-sm font-extrabold tracking-[.08em]">SURVIVOR SLIP</span>
      <span className="text-xs font-bold text-muted">
        <span className="text-green">{aliveCount}</span>/{entryCount} alive
      </span>
    </div>
  )

  const teamsUsedCard = usedTeams.length > 0 && (
    <div className="rounded-[14px] border border-card bg-surface px-[18px] py-4">
      <div className="mb-2.5 text-[11px] font-extrabold tracking-[.12em] text-muted">TEAMS USED</div>
      <div className="flex flex-wrap gap-1.5">
        {usedTeams.map((t) => (
          <span
            key={t.abbr}
            className="rounded-md border border-strong bg-surface-3 px-2 py-1 text-[11px] font-extrabold text-muted"
          >
            {t.abbr}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* status strip */}
      <div className="flex items-center gap-2 border-b border-hairline px-7 py-3.5 max-lg:px-4">
        {myPick ? (
          <span className="text-xs font-bold text-green">✓ Week {week} pick in — {myPick.teamAbbr}</span>
        ) : (
          <span className="text-xs font-bold text-amber">⚠ No pick yet for Week {week}</span>
        )}
        <span className="ml-auto text-xs text-muted max-md:hidden">
          One team to win straight-up · a tie counts as a loss · each team once a season · locks at that
          game&rsquo;s kickoff
        </span>
      </div>

      <div className="grid gap-6 px-7 pb-8 pt-6 max-lg:px-3.5 max-lg:pb-44 lg:grid-cols-[1fr_320px]">
        {/* game cards */}
        <div className="flex flex-col gap-2.5">
          {games.map((game) => {
            const started = gameStarted(game, now)
            const live = game.statusState === 'in'
            const finished = game.completed || game.canceled
            const containsSelection = selected?.gameId === game.id
            return (
              <div
                key={game.id}
                className={`grid grid-cols-[96px_1fr] items-center gap-4 rounded-xl border px-[18px] py-3.5 max-md:grid-cols-1 max-md:gap-2.5 ${
                  containsSelection ? 'border-amber bg-amber/4' : 'border-card bg-surface'
                } ${finished || (started && !live) ? 'opacity-55' : ''} ${live ? 'opacity-55' : ''}`}
              >
                {live ? (
                  <div className="max-md:flex max-md:items-center max-md:gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="live-dot h-[7px] w-[7px] rounded-full bg-accent" />
                      <span className="text-[11px] font-extrabold tracking-[.1em] text-accent">LIVE</span>
                    </div>
                    <div className="text-[13px] font-bold tabular-nums text-ink-2">{game.statusDetail}</div>
                  </div>
                ) : (
                  <div className="max-md:flex max-md:items-baseline max-md:gap-2">
                    <div className="text-[11px] font-bold tracking-[.1em] text-muted">{game.kickoffDay}</div>
                    <div className="text-[13px] font-bold text-ink-2">
                      {game.canceled ? 'CANCELED' : game.completed ? 'FINAL' : started ? 'STARTED' : game.kickoffTime}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <TeamButton game={game} side="away" />
                  <TeamButton game={game} side="home" />
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

        {/* desktop rail */}
        <div className="hidden h-fit flex-col gap-3.5 lg:sticky lg:top-4 lg:flex">
          <div className="rounded-[14px] border border-control bg-surface p-[18px]">
            {slipHeader}
            <SlipBody />
          </div>
          {teamsUsedCard}
        </div>

        {/* mobile: teams used above the sheet */}
        <div className="lg:hidden">{teamsUsedCard}</div>

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
            aria-label={sheetExpanded ? 'Collapse survivor slip' : 'Expand survivor slip'}
            onClick={() => setSheetExpanded((v) => !v)}
            className="mx-auto mb-2.5 block h-1 w-9 cursor-pointer rounded-sm bg-strong"
          />
          {sheetExpanded ? (
            <>
              {slipHeader}
              <SlipBody />
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="cursor-pointer text-left" onClick={() => setSheetExpanded(true)}>
                <div className="text-[13px] font-extrabold tracking-[.06em]">SURVIVOR SLIP</div>
                <div className="text-[11px] text-muted">
                  {entry ? entry.title : `No pick yet for Week ${week}`}
                </div>
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !selected}
                className="cursor-pointer rounded-[9px] bg-amber px-5 py-3 text-[13px] font-extrabold tracking-[.05em] text-amber-ink disabled:opacity-50"
              >
                {pending ? '…' : 'SUBMIT'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
