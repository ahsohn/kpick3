import { requireUser } from '@/lib/auth/session'
import { Shell } from '@/components/Shell'
import { getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { PrefsForm } from './prefs-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()
  const week = season ? await getCurrentWeek(season) : null

  return (
    <Shell user={user} week={week}>
      <div className="mx-auto max-w-2xl px-7 pb-10 pt-6 max-lg:px-4">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="ff-display mb-1 text-2xl text-primary">Email Settings</h2>
          <p className="mb-4 text-sm text-muted">
            Choose which emails go to {user.email}. Changes apply from the next send.
          </p>
          <PrefsForm emailReminders={user.emailReminders} emailRecaps={user.emailRecaps} />
        </section>
      </div>
    </Shell>
  )
}
