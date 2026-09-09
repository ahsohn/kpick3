'use server'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireUser, setSessionCookie } from '@/lib/auth/session'
import {
  normalizeDisplayName,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
} from '@/lib/auth/profile'

export interface SettingsResult {
  ok?: boolean
  error?: string
  info?: string
}

/** Saves the signed-in player's own email preferences (never anyone else's). */
export async function updateEmailPrefs(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const user = await requireUser()
  const emailReminders = formData.get('emailReminders') === 'on'
  const emailRecaps = formData.get('emailRecaps') === 'on'

  await db.update(users).set({ emailReminders, emailRecaps }).where(eq(users.id, user.id))
  revalidatePath('/settings')
  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Lets the signed-in player change their own display name and/or login email.
 * The session cookie is keyed by email, so an email change re-issues it here —
 * otherwise the very next request would bounce them to /login. Sessions on other
 * devices still carry the old email and will need a fresh sign-in.
 */
export async function updateProfile(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const user = await requireUser()
  const displayName = normalizeDisplayName(formData.get('displayName'))
  const email = normalizeEmail(formData.get('email'))

  const nameError = validateDisplayName(displayName)
  if (nameError) return { error: nameError }
  const emailError = validateEmail(email)
  if (emailError) return { error: emailError }

  const emailChanged = email !== user.email
  const nameChanged = displayName !== user.displayName
  if (!emailChanged && !nameChanged) return { ok: true, info: 'Nothing to change.' }

  if (emailChanged) {
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, user.id)))
      .limit(1)
    if (taken.length > 0) return { error: 'That email belongs to another player.' }
  }

  try {
    await db.update(users).set({ displayName, email }).where(eq(users.id, user.id))
  } catch {
    // Two players racing for the same address: the unique index wins the tie.
    return { error: 'That email belongs to another player.' }
  }

  // Do this before any revalidation so the re-rendered page already sees the new user.
  if (emailChanged) await setSessionCookie(email)

  revalidatePath('/settings')
  revalidatePath('/admin')
  if (nameChanged) {
    // Every board reads the live name.
    revalidatePath('/')
    revalidatePath('/my-picks')
    revalidatePath('/all-picks')
    revalidatePath('/standings')
    revalidatePath('/survivor')
    revalidatePath('/survivor/board')
  }

  const changed = [nameChanged && 'name', emailChanged && 'email'].filter(Boolean).join(' and ')
  return {
    ok: true,
    info: emailChanged
      ? `Updated your ${changed}. Sign in with ${email} from now on.`
      : `Updated your ${changed}.`,
  }
}
