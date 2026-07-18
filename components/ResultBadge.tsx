import type { PickResult } from '@/lib/picks/grading'

/** Bordered result pill: 10px 800 caps, tinted 1px border per result. */
export function ResultBadge({ result }: { result: PickResult }) {
  const styles: Record<PickResult, string> = {
    win: 'text-green border-green/40',
    loss: 'text-accent border-accent/40',
    push: 'text-amber border-amber/40',
    void: 'text-muted border-muted/35',
    pending: 'text-slate border-slate/35',
  }
  return (
    <span
      className={`rounded-[5px] border px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[.1em] ${styles[result]}`}
    >
      {result}
    </span>
  )
}
