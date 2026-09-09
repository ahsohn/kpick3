'use server'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth/session'
import { verifyPin } from '@/lib/auth/pin'

export interface LoginState {
  error?: string
  needsPin?: boolean
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const pin = String(formData.get('pin') ?? '').trim()
  if (!email) return { error: 'Enter your email.' }

  const rows = await db.select().from(users).where(eq(users.email, email))
  const user = rows[0]
  if (!user) {
    return { error: 'No account for that email. Ask the commissioner to add you.' }
  }

  // The super admin also has to present a PIN; everyone else is email-only.
  if (user.isAdmin && user.pinHash) {
    if (!pin) return { needsPin: true, error: 'Admin account — enter your PIN.' }
    if (!verifyPin(pin, user.pinHash)) return { needsPin: true, error: 'Wrong PIN.' }
  }

  await setSessionCookie(email)
  redirect('/')
}

export async function logout() {
  await clearSessionCookie()
  redirect('/login')
}
