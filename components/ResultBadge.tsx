import type { PickResult } from '@/lib/picks/grading'

export function ResultBadge({ result }: { result: PickResult }) {
  const styles: Record<PickResult, string> = {
    win: 'bg-success/20 text-success',
    loss: 'bg-danger/20 text-danger',
    push: 'bg-warning/20 text-warning',
    void: 'bg-line text-muted',
    pending: 'bg-secondary/40 text-[#7db3e8]',
  }
  return (
    <span className={`rounded px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[result]}`}>
      {result}
    </span>
  )
}
