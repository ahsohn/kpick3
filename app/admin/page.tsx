import { requireAdmin } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, users } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { Shell } from '@/components/Shell'
import { getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { formatKickoff } from '@/lib/format'
import { AdminPanels } from './panels'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await requireAdmin()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null

  const [allUsers, flagged] = await Promise.all([
    db.select().from(users).orderBy(asc(users.displayName)),
    db.select().from(games).where(eq(games.needsReview, true)),
  ])

  return (
    <Shell user={user} week={currentWeek}>
      <AdminPanels
        users={allUsers.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          isAdmin: u.isAdmin,
        }))}
        flagged={flagged.map((g) => ({
          id: g.id,
          label: `Week ${g.week}: ${g.awayTeamName} @ ${g.homeTeamName}`,
          detail: `${formatKickoff(g.kickoff)} · status: ${g.statusDetail ?? g.statusState}`,
          homeAbbr: g.homeTeamAbbr,
          awayAbbr: g.awayTeamAbbr,
        }))}
      />
    </Shell>
  )
}
