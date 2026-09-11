/**
 * Pool roles, lowest to highest:
 *  - player       — makes picks, sees the boards.
 *  - admin        — everything a player has, plus the read-only Week Pick Status table
 *                   in /admin (with emails + last-seen) so they can chase stragglers.
 *  - super_admin  — the commissioner: full /admin (players, sync, survivor enrollment,
 *                   needs-review), assigns the admin role, and can preview the site as
 *                   any role for troubleshooting.
 */
export const ROLES = ['player', 'admin', 'super_admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  player: 'Player',
  admin: 'Admin',
  super_admin: 'Super admin',
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/** Admins and super admins can open /admin (what they see there differs). */
export function canViewAdmin(role: Role): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function isSuperAdmin(role: Role): boolean {
  return role === 'super_admin'
}

/**
 * The role a request should be treated as. Only a real super admin can lower
 * themselves via the "view as" cookie; for anyone else (or a garbage cookie value)
 * the stored role wins. Viewing as a role never raises privileges.
 */
export function effectiveRole(actual: Role, viewAs: string | null | undefined): Role {
  if (actual !== 'super_admin') return actual
  if (!isRole(viewAs)) return actual
  return viewAs
}
