import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from '@/lib/auth/cookie'
import { hashPin, verifyPin } from '@/lib/auth/pin'

describe('session cookie', () => {
  it('round-trips an email', () => {
    const token = signSession('a@b.com', 'secret')
    expect(verifySession(token, 'secret')).toBe('a@b.com')
  })
  it('rejects a tampered payload', () => {
    const token = signSession('a@b.com', 'secret')
    const [, sig] = token.split('.')
    const forged = `${Buffer.from('admin@b.com').toString('base64url')}.${sig}`
    expect(verifySession(forged, 'secret')).toBeNull()
  })
  it('rejects the wrong secret and malformed tokens', () => {
    const token = signSession('a@b.com', 'secret')
    expect(verifySession(token, 'other')).toBeNull()
    expect(verifySession('garbage', 'secret')).toBeNull()
    expect(verifySession('', 'secret')).toBeNull()
  })
})

describe('admin PIN', () => {
  it('verifies the right PIN and rejects the wrong one', () => {
    const stored = hashPin('4821')
    expect(verifyPin('4821', stored)).toBe(true)
    expect(verifyPin('0000', stored)).toBe(false)
  })
  it('salts hashes (two hashes of the same PIN differ)', () => {
    expect(hashPin('4821')).not.toBe(hashPin('4821'))
  })
  it('rejects malformed stored values', () => {
    expect(verifyPin('4821', 'not-a-hash')).toBe(false)
  })
})
