import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe'

export const dynamic = 'force-dynamic'

function page(message: string, link?: { href: string; label: string }): NextResponse {
  const body = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>kpick3</title></head>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center">
<h1 style="font-size:1.25rem">kpick3</h1><p>${message}</p>
${link ? `<p><a href="${link.href}">${link.label}</a></p>` : ''}
</body></html>`
  return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const secret = process.env.SESSION_SECRET
  if (!secret) return page('Server is not configured.')

  const token = req.nextUrl.searchParams.get('token') ?? ''
  const userId = verifyUnsubscribeToken(token, secret)
  if (userId === null) return page('That unsubscribe link is not valid.')

  const resub = req.nextUrl.searchParams.get('resub') === '1'
  const updated = await db
    .update(users)
    .set({ emailOptOut: !resub })
    .where(eq(users.id, userId))
    .returning({ id: users.id })
  if (updated.length === 0) return page('That unsubscribe link is not valid.')

  return resub
    ? page('You are re-subscribed to kpick3 emails.')
    : page('You are unsubscribed from kpick3 reminder and recap emails.', {
        href: `/api/unsubscribe?token=${encodeURIComponent(token)}&resub=1`,
        label: 'Undo — re-subscribe',
      })
}
