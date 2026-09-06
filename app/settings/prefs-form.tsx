'use client'

import { useActionState } from 'react'
import { updateEmailPrefs, type SettingsResult } from './actions'

function PrefRow({
  name,
  label,
  detail,
  defaultChecked,
}: {
  name: string
  label: string
  detail: string
  defaultChecked: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface-light p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
      />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </label>
  )
}

export function PrefsForm({
  emailReminders,
  emailRecaps,
}: {
  emailReminders: boolean
  emailRecaps: boolean
}) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(updateEmailPrefs, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <PrefRow
        name="emailReminders"
        label="Pick reminders"
        detail="Saturday and Sunday mornings, only when you still have picks to make (Pick 3 and Survivor)."
        defaultChecked={emailReminders}
      />
      <PrefRow
        name="emailRecaps"
        label="Weekly recap"
        detail="Your results, standings and survivor news once the week's games are all graded."
        defaultChecked={emailRecaps}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-bold uppercase tracking-wider hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {state.ok && <span className="text-sm font-semibold text-success">Saved.</span>}
        {state.error && <span className="text-sm font-semibold text-danger">{state.error}</span>}
      </div>
    </form>
  )
}
