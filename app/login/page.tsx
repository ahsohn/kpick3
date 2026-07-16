'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface shadow-[0_8px_32px_rgba(213,10,10,.15)]">
        <div
          className="rounded-t-xl px-8 py-7 text-center"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
          }}
        >
          <h1 className="ff-display text-5xl leading-none drop-shadow-[2px_2px_8px_rgba(0,0,0,.5)]">
            NFL Pick&rsquo;em Pool
          </h1>
          <div className="mt-1 text-xs font-semibold tracking-[.25em] opacity-95">2026 SEASON</div>
        </div>

        <form action={action} className="px-8 pb-8 pt-6">
          <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
            Your email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border-2 border-line bg-surface-light px-4 py-3 text-base outline-none focus:border-primary"
          />

          {state.needsPin && (
            <>
              <label htmlFor="pin" className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-wider text-muted">
                Admin PIN
              </label>
              <input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full rounded-lg border-2 border-line bg-surface-light px-4 py-3 text-base outline-none focus:border-primary"
              />
            </>
          )}

          <button
            type="submit"
            disabled={pending}
            className="ff-display mt-5 w-full cursor-pointer rounded-lg py-3.5 text-2xl tracking-widest disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
              boxShadow: '0 4px 16px rgba(213,10,10,.3)',
            }}
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>

          {state.error && <p className="mt-3 text-center text-sm font-semibold text-danger">{state.error}</p>}

          <p className="mt-5 text-center text-xs italic text-muted">
            No password — the commissioner already added you to the pool.
          </p>
        </form>
      </div>
    </main>
  )
}
