import { describe, expect, it } from 'vitest'
import { signSession } from '../lib/auth/cookie'
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email/unsubscribe'

const SECRET = 'test-secret'

describe('unsubscribe tokens', () => {
  it('round-trips a user id', () => {
    const token = signUnsubscribeToken(42, SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(42)
  })

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken(42, SECRET)
    const [, sig] = token.split('.')
    const forged = `${Buffer.from('unsub:1').toString('base64url')}.${sig}`
    expect(verifyUnsubscribeToken(forged, SECRET)).toBeNull()
  })

  it('rejects the wrong secret', () => {
    const token = signUnsubscribeToken(42, SECRET)
    expect(verifyUnsubscribeToken(token, 'other-secret')).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifyUnsubscribeToken('', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('a.b.c', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('justonepart', SECRET)).toBeNull()
  })

  it('rejects a valid signature over a non-unsub payload', () => {
    // A session token (base64url(email).hmac) must not verify as an unsubscribe token.
    expect(verifyUnsubscribeToken(signSession('a@b.com', SECRET), SECRET)).toBeNull()
  })
})
