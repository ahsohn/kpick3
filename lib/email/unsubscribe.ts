import { createHmac, timingSafeEqual } from 'crypto'

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

/**
 * `<base64url("unsub:<userId>")>.<hmac>` — same shape and secret as the session
 * cookie, but a distinct payload prefix so the two token kinds can never cross over.
 * Tokens deliberately never expire: all one can do is toggle email opt-out.
 */
export function signUnsubscribeToken(userId: number, secret: string): string {
  const payload = Buffer.from(`unsub:${userId}`).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** Returns the userId if the signature and payload shape are valid, else null. */
export function verifyUnsubscribeToken(token: string, secret: string): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null

  const expected = sign(payload, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const decoded = Buffer.from(payload, 'base64url').toString('utf8')
  if (!decoded.startsWith('unsub:')) return null
  const id = parseInt(decoded.slice('unsub:'.length), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
