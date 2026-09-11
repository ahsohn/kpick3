'use server'

import { redirect } from 'next/navigation'
import { setViewAs } from '@/lib/auth/session'
import { isRole } from '@/lib/auth/roles'

/**
 * Super-admin "view as" switcher. Stores the chosen role in a cookie and sends them
 * back to the page they were on; if that page isn't visible to the new role (e.g.
 * /admin as a player) its own gate bounces them home.
 */
export async function switchViewAs(formData: FormData) {
  const role = formData.get('role')
  const path = String(formData.get('path') ?? '/')
  if (!isRole(role)) return
  await setViewAs(role)
  // Same-origin paths only; never bounce to a protocol-relative or absolute URL.
  redirect(path.startsWith('/') && !path.startsWith('//') ? path : '/')
}
