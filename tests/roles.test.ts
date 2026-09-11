import { describe, expect, it } from 'vitest'
import { canViewAdmin, effectiveRole, isRole, isSuperAdmin, ROLES } from '@/lib/auth/roles'

describe('role guards', () => {
  it('recognizes only the three roles', () => {
    for (const r of ROLES) expect(isRole(r)).toBe(true)
    expect(isRole('owner')).toBe(false)
    expect(isRole('')).toBe(false)
    expect(isRole(undefined)).toBe(false)
    expect(isRole(1)).toBe(false)
  })
  it('lets admins and super admins into /admin, not players', () => {
    expect(canViewAdmin('player')).toBe(false)
    expect(canViewAdmin('admin')).toBe(true)
    expect(canViewAdmin('super_admin')).toBe(true)
  })
  it('only the super admin manages the pool', () => {
    expect(isSuperAdmin('player')).toBe(false)
    expect(isSuperAdmin('admin')).toBe(false)
    expect(isSuperAdmin('super_admin')).toBe(true)
  })
})

describe('view-as (effectiveRole)', () => {
  it('lets a super admin preview as a lower role', () => {
    expect(effectiveRole('super_admin', 'player')).toBe('player')
    expect(effectiveRole('super_admin', 'admin')).toBe('admin')
    expect(effectiveRole('super_admin', 'super_admin')).toBe('super_admin')
  })
  it('ignores a missing or garbage cookie', () => {
    expect(effectiveRole('super_admin', undefined)).toBe('super_admin')
    expect(effectiveRole('super_admin', null)).toBe('super_admin')
    expect(effectiveRole('super_admin', 'owner')).toBe('super_admin')
  })
  it('never lets anyone else change role — up or down', () => {
    expect(effectiveRole('admin', 'super_admin')).toBe('admin')
    expect(effectiveRole('admin', 'player')).toBe('admin')
    expect(effectiveRole('player', 'admin')).toBe('player')
    expect(effectiveRole('player', 'super_admin')).toBe('player')
  })
})
