import Link from 'next/link'

/** Sub-bar under the header: week chips (?week=N links) + optional helper text. */
export function WeekSelector({
  weeks,
  current,
  basePath,
  helper,
}: {
  weeks: number[]
  current: number
  basePath: string
  helper?: string
}) {
  if (weeks.length <= 1 && !helper) return null
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-hairline px-7 py-3.5 max-lg:px-4">
      {weeks.length > 1 && (
        <>
          <span className="text-[11px] font-bold tracking-[.12em] text-muted">WEEK</span>
          {weeks.map((w) => (
            <Link
              key={w}
              href={`${basePath}?week=${w}`}
              className={`rounded-md px-[11px] py-1 text-[13px] font-bold ${
                w === current ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              {w}
            </Link>
          ))}
        </>
      )}
      {helper && (
        <span className="ml-auto whitespace-nowrap text-xs text-muted max-sm:hidden">{helper}</span>
      )}
    </div>
  )
}
