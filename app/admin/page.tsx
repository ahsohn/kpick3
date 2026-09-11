import { requireAdmin } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, users, picks, survivorPicks } from '@/lib/db/schema'
import { and, asc, count, eq } from 'drizzle-orm'
import { Shell } from '@/components/Shell'
import { getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { getSurvivorSeasonData } from '@/lib/survivor/queries'
import { formatKickoff } from '@/lib/format'
import { isSuperAdmin } from '@/lib/auth/roles'
import { AdminPanels, type SurvivorAdminRow, type WeekStatusRow } from './panels'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  // Admins get the read-only pick-status table; the super admin gets everything.
  const user = await requireAdmin()
  const canManage = isSuperAdmin(user.role)
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null

  const [allUsers, flagged, survivor, pickCounts, survivorPickCounts, weekPicks, weekSurvivorPicks] = await Promise.all([
    db.select().from(users).orderBy(asc(users.displayName)),
    db.select().from(games).where(eq(games.needsReview, true)),
    season !== null ? getSurvivorSeasonData(season, user.id) : Promise.resolve(null),
    db.select({ userId: picks.userId, n: count() }).from(picks).groupBy(picks.userId),
    db.select({ userId: survivorPicks.userId, n: count() }).from(survivorPicks).groupBy(survivorPicks.userId),
    season !== null && currentWeek !== null
      ? db
          .select({ userId: picks.userId, n: count() })
          .from(picks)
          .where(and(eq(picks.season, season), eq(picks.week, currentWeek)))
          .groupBy(picks.userId)
      : Promise.resolve([]),
    season !== null && currentWeek !== null
      ? db
          .select({ userId: survivorPicks.userId })
          .from(survivorPicks)
          .where(and(eq(survivorPicks.season, season), eq(survivorPicks.week, currentWeek)))
      : Promise.resolve([]),
  ])
  const weekPicksByUser = new Map(weekPicks.map((r) => [r.userId, r.n]))
  const weekSurvivorByUser = new Set(weekSurvivorPicks.map((r) => r.userId))
  const picksByUser = new Map(pickCounts.map((r) => [r.userId, r.n]))
  const survivorPicksByUser = new Map(survivorPickCounts.map((r) => [r.userId, r.n]))

  const survivorByUser = new Map((survivor?.rows ?? []).map((r) => [r.userId, r.status]))
  const survivorRows: SurvivorAdminRow[] = allUsers.map((u) => {
    const status = survivorByUser.get(u.id)
    return {
      userId: u.id,
      displayName: u.displayName,
      enrolled: status !== undefined,
      alive: status?.alive ?? null,
      eliminatedWeek: status?.eliminatedWeek ?? null,
    }
  })

  const weekStatusRows: WeekStatusRow[] = allUsers.map((u) => {
    const status = survivorByUser.get(u.id)
    const survivorState: WeekStatusRow['survivor'] =
      status === undefined
        ? 'not-enrolled'
        : !status.alive && status.eliminatedWeek !== currentWeek
          ? 'eliminated'
          : weekSurvivorByUser.has(u.id)
            ? 'picked'
            : 'missing'
    return {
      userId: u.id,
      displayName: u.displayName,
      email: u.email,
      // Formatted server-side so the client table never renders in a viewer's local zone.
      lastSeen: u.lastSeenAt ? formatKickoff(u.lastSeenAt) : null,
      pick3Count: weekPicksByUser.get(u.id) ?? 0,
      survivor: survivorState,
    }
  })

  return (
    <Shell user={user} week={currentWeek}>
      <div className="mx-auto max-w-6xl px-7 pb-10 pt-6 max-lg:px-4">
      <AdminPanels
        canManage={canManage}
        users={allUsers.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          emailReminders: u.emailReminders,
          emailRecaps: u.emailRecaps,
          lastSeen: u.lastSeenAt ? formatKickoff(u.lastSeenAt) : null,
          isSelf: u.id === user.id,
          pickCount: picksByUser.get(u.id) ?? 0,
          survivorPickCount: survivorPicksByUser.get(u.id) ?? 0,
        }))}
        survivorRows={survivorRows}
        survivorSeason={season}
        weekStatus={{ week: currentWeek, rows: weekStatusRows }}
        flagged={flagged.map((g) => ({
          id: g.id,
          label: `Week ${g.week}: ${g.awayTeamName} @ ${g.homeTeamName}`,
          detail: `${formatKickoff(g.kickoff)} · status: ${g.statusDetail ?? g.statusState}`,
          homeAbbr: g.homeTeamAbbr,
          awayAbbr: g.awayTeamAbbr,
        }))}
      />
      </div>
    </Shell>
  )
}
