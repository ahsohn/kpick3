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

export function SurvivorPickPanel({
  games,
  usedTeamAbbrs,
  myPick,
  week,
}: {
  games: BoardGame[]
  usedTeamAbbrs: string[]
  myPick: MySurvivorPick | null
  week: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<{ gameId: number; side: 'home' | 'away' } | null>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const used = new Set(usedTeamAbbrs)
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
        router.refresh()
      }
    })
  }

  function remove() {
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

  return (
    <section className="mb-8 rounded-xl border border-line bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="ff-display text-2xl text-primary">Your Week {week} Survivor Pick</h2>
        {myPick && (
          <span className="rounded bg-success/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-success">
            Pick in: {myPick.teamAbbr}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">
        One team to win straight-up — no spreads. A tie counts as a loss, and each team can
        only be used once a season. Your pick locks at that game&rsquo;s kickoff.
      </p>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {games.map((game) => {
          const started = new Date(game.kickoffIso).getTime() <= now || game.statusState !== 'pre'
          const gameLocked = started || game.canceled

          return (
            <div key={game.id} className="rounded-xl border-2 border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  {game.statusState === 'in' && game.statusDetail ? game.statusDetail : game.kickoffLabel}
                </span>
                {game.canceled ? (
                  <Badge tone="danger">Canceled</Badge>
                ) : started ? (
                  <Badge tone="danger">{game.statusState === 'in' ? 'Live' : game.completed ? 'Final' : 'Started'}</Badge>
                ) : null}
              </div>

              {(['away', 'home'] as const).map((side) => {
                const abbr = side === 'away' ? game.awayTeamAbbr : game.homeTeamAbbr
                const name = side === 'away' ? game.awayTeamName : game.homeTeamName
                const logo = side === 'away' ? game.awayTeamLogo : game.homeTeamLogo
                const score = side === 'away' ? game.awayScore : game.homeScore
                const isUsed = used.has(abbr)
                const isMyPick = myPick?.gameId === game.id && myPick.side === side
                const isSelected = selected?.gameId === game.id && selected.side === side
                const locked = gameLocked || isUsed

                return (
                  <button
                    key={side}
                    type="button"
                    disabled={(locked && !isMyPick) || pending}
                    onClick={() => {
                      if (locked) return
                      setMessage(null)
                      setSelected(isSelected ? null : { gameId: game.id, side })
                    }}
                    className={`mb-2 flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-all last:mb-0 ${
                      isSelected || isMyPick
                        ? 'border-primary bg-primary/20'
                        : 'border-transparent bg-surface-light'
                    } ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/40 hover:bg-primary/10'} ${
                      isMyPick ? '!opacity-100' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo} alt="" className="h-6 w-6" />
                      {name}
                      {isMyPick && <span className="text-xs font-bold uppercase text-success">your pick</span>}
                      {isUsed && !isMyPick && (
                        <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">used</span>
                      )}
                    </span>
                    {started && score !== null && (
                      <span className="text-lg font-bold tabular-nums">{score}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || !selected}
          className="ff-display block w-full max-w-sm cursor-pointer rounded-xl py-3.5 text-2xl tracking-widest transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            boxShadow: '0 4px 16px rgba(213,10,10,.3)',
          }}
        >
          {pending
            ? 'Saving…'
            : selected
              ? myPick
                ? 'Change survivor pick'
                : 'Submit survivor pick'
              : myPick
                ? 'Select a team to change your pick'
                : 'Select a team'}
        </button>
        {myPick && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="cursor-pointer rounded-lg border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
          >
            ✕ Remove pick (allowed until kickoff)
          </button>
        )}
      </div>

      {usedTeamAbbrs.length > 0 && (
        <p className="mt-4 text-center text-xs text-muted">
          Teams you&rsquo;ve used: <span className="font-semibold">{usedTeamAbbrs.join(' · ')}</span>
        </p>
      )}
    </section>
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
