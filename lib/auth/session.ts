import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, type User } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { signSession, verifySession } from './cookie'

const COOKIE_NAME = 'kp3_session'

/** How stale `users.last_seen_at` may get before a page load refreshes it. */
const SEEN_THROTTLE_MS = 15 * 60 * 1000

/** True when the stored last-seen stamp is missing or older than the throttle window. */
export function shouldStampSeen(lastSeenAt: Date | null, now: Date = new Date()): boolean {
  return lastSeenAt === null || now.getTime() - lastSeenAt.getTime() >= SEEN_THROTTLE_MS
}

export async function getCurrentUser(): Promise<User | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')

  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null
  const email = verifySession(token, secret)
  if (!email) return null

  const rows = await db.select().from(users).where(eq(users.email, email))
  const user = rows[0] ?? null
  if (user && shouldStampSeen(user.lastSeenAt)) {
    // Fire-and-forget would be nicer, but serverless functions can be frozen the
    // moment the response is sent, so await it. It's one small write per player per
    // throttle window. Never let a stamping failure take a page down.
    const now = new Date()
    try {
      await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, user.id))
      user.lastSeenAt = now
    } catch (err) {
      console.error('[auth] failed to stamp last_seen_at:', err)
    }
  }
  return user
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
