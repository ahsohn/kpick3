'use server'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'

export interface SettingsResult {
  ok?: boolean
  error?: string
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
