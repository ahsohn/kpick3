'use client'

import { useActionState } from 'react'
import { MAX_DISPLAY_NAME } from '@/lib/auth/profile'
import { updateProfile, type SettingsResult } from './actions'

function Field({
  name,
  label,
  detail,
  defaultValue,
  type = 'text',
  maxLength,
  autoComplete,
}: {
  name: string
  label: string
  detail: string
  defaultValue: string
  type?: string
  maxLength?: number
  autoComplete?: string
}) {
  return (
    <label className="block rounded-lg bg-surface-light p-4">
      <span className="block text-sm font-bold">{label}</span>
      <span className="mb-2 block text-sm text-muted">{detail}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border border-control bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-[var(--color-accent)]"
      />
    </label>
  )
}

export function ProfileForm({
  displayName,
  email,
  isAdmin,
}: {
  displayName: string
  email: string
  isAdmin: boolean
}) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(updateProfile, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        name="displayName"
        label="Display name"
        detail="How you appear on the standings, the pick boards and the survivor grid."
        defaultValue={displayName}
        maxLength={MAX_DISPLAY_NAME}
        autoComplete="nickname"
      />
      <Field
        name="email"
        label="Email"
        detail={
          isAdmin
            ? 'Your sign-in and where pool emails go. Changing it also means updating ADMIN_EMAIL before the next seed run.'
            : 'Your sign-in and where pool emails go. Changing it signs out any other devices.'
        }
        defaultValue={email}
        type="email"
        autoComplete="email"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-bold uppercase tracking-wider hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {state.ok && (
          <span className="text-sm font-semibold text-success">{state.info ?? 'Saved.'}</span>
        )}
        {state.error && <span className="text-sm font-semibold text-danger">{state.error}</span>}
      </div>
    </form>
  )
}
