import { NextRequest, NextResponse } from 'next/server'
import { runSyncPass } from '@/lib/espn/sync'
import { runNotifyPass } from '@/lib/notify/pass'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  // Scheduler sends `Authorization: Bearer <CRON_SECRET>`. Also allow ?secret= for manual runs.
  const provided = auth?.replace(/^Bearer\s+/i, '') ?? req.nextUrl.searchParams.get('secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await runSyncPass()
  // Notifications ride the same cron but must never fail the sync response.
  let notified: Awaited<ReturnType<typeof runNotifyPass>> | { error: string }
  try {
    notified = await runNotifyPass()
  } catch (err) {
    notified = { error: err instanceof Error ? err.message : 'notify failed' }
  }
  return NextResponse.json({ ok: true, ...result, notified })
}
