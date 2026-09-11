'use client'

import { usePathname } from 'next/navigation'
import { switchViewAs } from '@/app/actions/view-as'
import { ROLES, ROLE_LABEL, type Role } from '@/lib/auth/roles'

/**
 * Troubleshooting strip for the super admin: pick a role and the whole site (pages,
 * tabs, actions) renders as it would for someone with that role. Sits under the
 * header on every page so there's always a way back to Super admin.
 */
export function ViewAsBar({ viewingAs }: { viewingAs: Role }) {
  const pathname = usePathname()
  const previewing = viewingAs !== 'super_admin'
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b px-4 py-1.5 text-[11px] font-semibold ${
        previewing ? 'border-amber/40 bg-amber/10 text-amber' : 'border-control bg-surface-2 text-muted'
      }`}
    >
      <span className="tracking-[.12em]">
        {previewing ? `PREVIEWING AS ${ROLE_LABEL[viewingAs].toUpperCase()}` : 'VIEW AS'}
      </span>
      <span className="flex gap-[3px] rounded-lg border border-control bg-surface-3 p-[2px]">
        {ROLES.map((role) => {
          const active = role === viewingAs
          return (
            <form key={role} action={switchViewAs}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="path" value={pathname} />
              <button
                type="submit"
                disabled={active}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[.04em] disabled:cursor-default ${
                  active
                    ? previewing
                      ? 'bg-amber text-amber-ink'
                      : 'bg-control text-ink'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {ROLE_LABEL[role]}
              </button>
            </form>
          )
        })}
      </span>
      {previewing && (
        <span className="text-amber/80">Actions are limited to that role too.</span>
      )}
    </div>
  )
}
