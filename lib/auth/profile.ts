/**
 * Validation for the two self-editable profile fields. Shared by the player-facing
 * /settings form and the admin's add/rename actions so the rules can't drift.
 */

export const MAX_DISPLAY_NAME = 40

/** Lowercases + trims so the unique `users.email` index compares apples to apples. */
export function normalizeEmail(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

/** Returns an error message, or null when the (already normalized) email is usable. */
export function validateEmail(email: string): string | null {
  if (!email) return 'Enter your email.'
  // Deliberately loose: one "@" with something on both sides and a dot in the domain.
  // The real deliverability check is whether email actually reaches them.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email.'
  if (email.length > 254) return 'That email is too long.'
  return null
}

/** Collapses internal whitespace so names line up in standings. */
export function normalizeDisplayName(raw: unknown): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ')
}

/** Returns an error message, or null when the (already normalized) name is usable. */
export function validateDisplayName(name: string): string | null {
  if (!name) return 'Enter a display name.'
  if (name.length > MAX_DISPLAY_NAME) return `Keep your name to ${MAX_DISPLAY_NAME} characters.`
  return null
}
