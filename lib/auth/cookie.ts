import { createHmac, timingSafeEqual } from 'crypto'

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

/** Produces `<base64url(email)>.<hmac>`. */
export function signSession(email: string, secret: string): string {
  const payload = Buffer.from(email).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** Returns the email if the signature is valid, else null. */
export function verifySession(token: string, secret: string): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null

  const expected = sign(payload, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return Buffer.from(payload, 'base64url').toString('utf8')
}
