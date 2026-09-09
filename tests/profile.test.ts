import { describe, expect, it } from 'vitest'
import {
  MAX_DISPLAY_NAME,
  normalizeDisplayName,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
} from '@/lib/auth/profile'

describe('email', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Al@Example.COM ')).toBe('al@example.com')
    expect(normalizeEmail(null)).toBe('')
  })
  it('accepts ordinary addresses', () => {
    expect(validateEmail('al@example.com')).toBeNull()
    expect(validateEmail('first.last+tag@sub.example.co.uk')).toBeNull()
  })
  it('rejects empty, missing "@", missing domain dot, spaces and overlong', () => {
    expect(validateEmail('')).toBe('Enter your email.')
    expect(validateEmail('al')).toBe('Enter a valid email.')
    expect(validateEmail('al@example')).toBe('Enter a valid email.')
    expect(validateEmail('a l@example.com')).toBe('Enter a valid email.')
    expect(validateEmail(`${'a'.repeat(250)}@x.com`)).toBe('That email is too long.')
  })
})

describe('display name', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeDisplayName('  Big   Al ')).toBe('Big Al')
    expect(normalizeDisplayName(undefined)).toBe('')
  })
  it('accepts a normal name and rejects empty or overlong', () => {
    expect(validateDisplayName('Big Al')).toBeNull()
    expect(validateDisplayName('')).toBe('Enter a display name.')
    expect(validateDisplayName('x'.repeat(MAX_DISPLAY_NAME))).toBeNull()
    expect(validateDisplayName('x'.repeat(MAX_DISPLAY_NAME + 1))).toMatch(/characters/)
  })
})
