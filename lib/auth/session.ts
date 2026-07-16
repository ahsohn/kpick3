import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, type User } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { signSession, verifySession } from './cookie'

const COOKIE_NAME = 'kp3_session'

export async function getCurrentUser(): Promise<User | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')

  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null
  const email = verifySession(token, secret)
  if (!email) return null

  const rows = await db.select().from(users).where(eq(users.email, email))
  return rows[0] ?? null
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (!user.isAdmin) redirect('/')
  return user
}

export async function setSessionCookie(email: string) {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  const token = signSession(email, secret)
  ;(await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // one season
  })
}

export async function clearSessionCookie() {
  ;(await cookies()).delete(COOKIE_NAME)
}
