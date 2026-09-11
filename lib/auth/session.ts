import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users, type User } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { signSession, verifySession } from './cookie'
import { canViewAdmin, effectiveRole, isSuperAdmin, type Role } from './roles'

const COOKIE_NAME = 'kp3_session'

/**
 * Super-admin troubleshooting toggle: holds the role they've chosen to browse the
 * site as ('player' | 'admin'). Only honored when the session's real role is
 * super_admin, so it can never raise anyone's privileges. Cleared on logout.
 */
const VIEW_AS_COOKIE = 'kp3_view_as'

/** How stale `users.last_seen_at` may get before a page load refreshes it. */
const SEEN_THROTTLE_MS = 15 * 60 * 1000

/** True when the stored last-seen stamp is missing or older than the throttle window. */
export function shouldStampSeen(lastSeenAt: Date | null, now: Date = new Date()): boolean {
  return lastSeenAt === null || now.getTime() - lastSeenAt.getTime() >= SEEN_THROTTLE_MS
}

/**
 * The signed-in user exactly as stored (real role, no view-as applied). Memoized per
 * request so the page, the Shell and any action gate share one lookup + one stamp.
 */
const loadSessionUser = cache(async (): Promise<User | null> => {
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
})

async function readViewAs(): Promise<string | undefined> {
  return (await cookies()).get(VIEW_AS_COOKIE)?.value
}

/**
 * The signed-in user with their *effective* role: a super admin previewing the site
 * as a player or admin comes back as that role, so every page and action gate
 * behaves exactly as it would for a real user of that role.
 */
export async function getCurrentUser(): Promise<User | null> {
  const user = await loadSessionUser()
  if (!user) return null
  const role = effectiveRole(user.role, await readViewAs())
  return role === user.role ? user : { ...user, role }
}

/**
 * State for the super admin's "view as" switcher. Null unless the session's real
 * role is super_admin — the bar must stay visible while previewing a lower role,
 * otherwise there'd be no way back.
 */
export async function getViewAs(): Promise<{ viewingAs: Role } | null> {
  const user = await loadSessionUser()
  if (!user || !isSuperAdmin(user.role)) return null
  return { viewingAs: effectiveRole(user.role, await readViewAs()) }
}

/** Sets (or, for super_admin, clears) the view-as cookie. No-op for non-super-admins. */
export async function setViewAs(role: Role): Promise<boolean> {
  const user = await loadSessionUser()
  if (!user || !isSuperAdmin(user.role)) return false
  const jar = await cookies()
  if (role === 'super_admin') {
    jar.delete(VIEW_AS_COOKIE)
  } else {
    jar.set(VIEW_AS_COOKIE, role, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12, // a troubleshooting session, not a season
    })
  }
  return true
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/** Admins and super admins: may open /admin (admins get the read-only status view). */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (!canViewAdmin(user.role)) redirect('/')
  return user
}

/** The commissioner only: every mutating /admin action. */
export async function requireSuperAdmin(): Promise<User> {
  const user = await requireUser()
  if (!isSuperAdmin(user.role)) redirect('/')
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
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
  jar.delete(VIEW_AS_COOKIE)
}
