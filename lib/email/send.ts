export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export type SendResult = { sent: true } | { sent: false; reason: string }

/**
 * Sends one email via Resend's REST API. Without RESEND_API_KEY/EMAIL_FROM (local
 * dev, tests, pre-DNS prod) it's a logged no-op, so callers run the same code path
 * everywhere but only a configured deployment actually emails anyone.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.log(`[email noop] to=${[msg.to].flat().join(',')} subject="${msg.subject}"`)
    return { sent: false, reason: 'RESEND_API_KEY or EMAIL_FROM not set' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [msg.to].flat(),
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.headers ? { headers: msg.headers } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { sent: false, reason: `Resend ${res.status}: ${body.slice(0, 200)}` }
  }
  return { sent: true }
}
