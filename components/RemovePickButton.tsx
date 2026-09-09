'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removePick } from '@/app/actions/picks'

/**
 * "Remove" control for a pending pick on My Picks. Only rendered for games that haven't
 * kicked off; the server re-checks that before deleting anything.
 */
export function RemovePickButton({ gameId, label }: { gameId: number; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function remove() {
    if (!window.confirm(`Remove your pick on ${label}? You can pick a different game until kickoff.`)) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await removePick(gameId)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="cursor-pointer rounded-[7px] border border-control bg-surface px-2.5 py-1.5 text-[11px] font-extrabold tracking-[.08em] text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-50"
      >
        {pending ? 'REMOVING…' : 'REMOVE'}
      </button>
      {error && <span className="text-right text-[11px] font-semibold text-accent">{error}</span>}
    </div>
  )
}
