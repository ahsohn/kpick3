import { requireUser } from '@/lib/auth/session'
import { getStandings, getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

const RANK_COLORS = ['text-[#ffd700]', 'text-[#c0c0c0]', 'text-[#cd7f32]']

export default async function StandingsPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null
  const standings = season ? await getStandings(season) : []

  return (
    <Shell user={user} week={currentWeek}>
      {standings.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          No graded picks yet — standings appear after the first games go final.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b-2 border-line bg-surface-light text-left">
                {['Rank', 'Player', 'Points', 'Wins', 'Losses', 'Pushes', 'Parlays'].map((h) => (
                  <th key={h} className="ff-display px-4 py-3 text-lg tracking-wider text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr
                  key={row.userId}
                  className={`border-b border-line last:border-b-0 hover:bg-surface-light ${
                    row.userId === user.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className={`px-4 py-3 text-lg font-bold ${RANK_COLORS[i] ?? 'text-primary'}`}>{i + 1}</td>
                  <td className="px-4 py-3 font-semibold">
                    {row.displayName}
                    {row.userId === user.id && <span className="ml-2 text-xs uppercase text-muted">you</span>}
                  </td>
                  <td className="px-4 py-3 text-lg font-bold">{row.points}</td>
                  <td className="px-4 py-3">{row.wins}</td>
                  <td className="px-4 py-3">{row.losses}</td>
                  <td className="px-4 py-3">{row.pushes}</td>
                  <td className="px-4 py-3">{row.parlays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  )
}
