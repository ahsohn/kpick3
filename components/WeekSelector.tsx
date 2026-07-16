import Link from 'next/link'

/** Week pill links, ?week=N on the given base path. */
export function WeekSelector({
  weeks,
  current,
  basePath,
}: {
  weeks: number[]
  current: number
  basePath: string
}) {
  if (weeks.length <= 1) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted">Week</span>
      {weeks.map((w) => (
        <Link
          key={w}
          href={`${basePath}?week=${w}`}
          className={`rounded-md px-2.5 py-1 text-sm font-bold ${
            w === current ? 'bg-primary text-white' : 'bg-surface-light text-muted hover:text-ink'
          }`}
        >
          {w}
        </Link>
      ))}
    </div>
  )
}
