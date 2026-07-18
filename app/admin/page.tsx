import { requireAdmin } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, users } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { Shell } from '@/components/Shell'
import { getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { getSurvivorSeasonData } from '@/lib/survivor/queries'
import { formatKickoff } from '@/lib/format'
import { AdminPanels, type SurvivorAdminRow } from './panels'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await requireAdmin()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null

  const [allUsers, flagged, survivor] = await Promise.all([
    db.select().from(users).orderBy(asc(users.displayName)),
    db.select().from(games).where(eq(games.needsReview, true)),
    season !== null ? getSurvivorSeasonData(season, user.id) : Promise.resolve(null),
  ])

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

  return (
    <Shell user={user} week={currentWeek}>
      <div className="mx-auto max-w-6xl px-7 pb-10 pt-6 max-lg:px-4">
      <AdminPanels
        users={allUsers.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          isAdmin: u.isAdmin,
        }))}
        survivorRows={survivorRows}
        survivorSeason={season}
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
