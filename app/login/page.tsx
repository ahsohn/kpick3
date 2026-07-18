'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <div className="text-[44px] font-extrabold italic leading-none tracking-[-.01em]">
            KPICK<span className="text-accent">3</span>
          </div>
          <div className="mt-2.5 text-[11px] font-bold tracking-[.24em] text-muted">
            NFL PICK&rsquo;EM POOL · 2026 SEASON
          </div>
        </div>

        <form action={action} className="rounded-[14px] border border-card bg-surface p-6">
          <label
            htmlFor="email"
            className="mb-2 block text-[11px] font-bold tracking-[.12em] text-muted"
          >
            YOUR EMAIL
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-[10px] border border-strong bg-surface-3 px-3.5 py-[13px] text-sm outline-none placeholder:text-placeholder focus:border-accent"
          />

          {state.needsPin && (
            <>
              <label
                htmlFor="pin"
                className="mb-2 mt-4 block text-[11px] font-bold tracking-[.12em] text-muted"
              >
                ADMIN PIN
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full rounded-[10px] border border-strong bg-surface-3 px-3.5 py-[13px] text-sm outline-none focus:border-accent"
              />
            </>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-4 w-full cursor-pointer rounded-[10px] bg-accent p-3.5 text-center text-sm font-extrabold tracking-[.06em] text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? 'SIGNING IN…' : 'SIGN IN'}
          </button>

          {state.error && (
            <p className="mt-3 text-center text-sm font-semibold text-accent">{state.error}</p>
          )}

          <p className="mb-0 mt-4 text-center text-xs leading-relaxed text-muted">
            No password — the commissioner already added you to the pool.
          </p>
        </form>
      </div>
    </main>
  )
}
