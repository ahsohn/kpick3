import { formatKickoff } from '@/lib/format'
import type { PickResult } from '@/lib/picks/grading'

export const SITE_URL = 'https://kpick3.com'

export interface EmailContent {
  subject: string
  html: string
  text: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function layout(bodyHtml: string, unsubscribeUrl: string | null): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:0 auto;padding:16px;color:#222">
<h2 style="margin:0 0 12px;font-size:18px"><a href="${SITE_URL}" style="color:#222;text-decoration:none">kpick3</a></h2>
${bodyHtml}
${unsubscribeUrl ? `<p style="margin-top:28px;font-size:12px;color:#888"><a href="${unsubscribeUrl}" style="color:#888">Unsubscribe from these emails</a></p>` : ''}
</div>`
}

export interface ReminderEmailInput {
  displayName: string
  window: 'sat' | 'sun'
  week: number
  pick3: { pickCount: number; nextKickoff: Date } | null
  survivor: { remainingPickable: number } | null
  unsubscribeUrl: string
}

export function reminderEmail(input: ReminderEmailInput): EmailContent {
  const prefix = input.window === 'sun' ? 'Last call: ' : ''
  const subject = `${prefix}Week ${input.week} picks — kpick3`

  const lines: string[] = []
  if (input.pick3) {
    const missing = 3 - input.pick3.pickCount
    lines.push(
      `You have ${input.pick3.pickCount}/3 pick'em picks in — ${missing} more to make. ` +
        `Next kickoff: ${formatKickoff(input.pick3.nextKickoff)}.`
    )
  }
  if (input.survivor) {
    const n = input.survivor.remainingPickable
    lines.push(
      `No survivor pick yet — ${n} usable game${n === 1 ? '' : 's'} left this week. ` +
        `Miss the week and you're out.`
    )
  }

  const text = `Hey ${input.displayName},\n\n${lines.join('\n\n')}\n\nMake your picks: ${SITE_URL}\n\nUnsubscribe: ${input.unsubscribeUrl}\n`
  const html = layout(
    `<p>Hey ${esc(input.displayName)},</p>` +
      lines.map((l) => `<p>${esc(l)}</p>`).join('') +
      `<p><a href="${SITE_URL}" style="font-weight:bold">Make your picks →</a></p>`,
    input.unsubscribeUrl
  )
  return { subject, html, text }
}

export interface RecapPickLine {
  label: string // e.g. "KC −3.5 vs LAC"
  result: PickResult
}

export interface RecapStandingsRow {
  displayName: string
  points: number
  isYou: boolean
}

export interface RecapEmailInput {
  displayName: string
  week: number
  myPicks: RecapPickLine[]
  weekPoints: number
  parlay: boolean
  standings: RecapStandingsRow[]
  survivorEliminated: string[]
  survivorChampions: string[]
  unsubscribeUrl: string
}

const RESULT_MARK: Record<PickResult, string> = {
  win: '✓', loss: '✗', push: '–', void: '–', pending: '·',
}

export function recapEmail(input: RecapEmailInput): EmailContent {
  const subject = `Week ${input.week} results — kpick3`

  const pickLines = input.myPicks.map((p) => `${RESULT_MARK[p.result]} ${p.label} (${p.result})`)
  const pointsLine =
    `You scored ${input.weekPoints} point${input.weekPoints === 1 ? '' : 's'} in week ${input.week}` +
    (input.parlay ? ' — 3-for-3 parlay! 🎉' : '.')
  const standingsLines = input.standings.map(
    (s, i) => `${i + 1}. ${s.displayName}${s.isYou ? ' (you)' : ''} — ${s.points} pts`
  )
  const survivorLines = [
    ...(input.survivorEliminated.length > 0
      ? [`Survivor eliminations: ${input.survivorEliminated.join(', ')}`]
      : []),
    ...(input.survivorChampions.length > 0
      ? [`Survivor champion${input.survivorChampions.length > 1 ? 's' : ''}: ${input.survivorChampions.join(', ')} 🏆`]
      : []),
  ]

  const text =
    `Hey ${input.displayName},\n\n${pointsLine}\n\n` +
    (pickLines.length > 0 ? `Your picks:\n${pickLines.join('\n')}\n\n` : `You made no picks this week.\n\n`) +
    `Standings:\n${standingsLines.join('\n')}\n\n` +
    (survivorLines.length > 0 ? `${survivorLines.join('\n')}\n\n` : '') +
    `Full results: ${SITE_URL}\n\nUnsubscribe: ${input.unsubscribeUrl}\n`

  const html = layout(
    `<p>Hey ${esc(input.displayName)},</p><p>${esc(pointsLine)}</p>` +
      (pickLines.length > 0
        ? `<ul style="padding-left:20px">${input.myPicks.map((p) => `<li>${RESULT_MARK[p.result]} ${esc(p.label)} <em>(${p.result})</em></li>`).join('')}</ul>`
        : `<p>You made no picks this week.</p>`) +
      `<p><strong>Standings</strong></p><ol style="padding-left:20px">${input.standings
        .map((s) => `<li>${esc(s.displayName)}${s.isYou ? ' <strong>(you)</strong>' : ''} — ${s.points} pts</li>`)
        .join('')}</ol>` +
      survivorLines.map((l) => `<p>${esc(l)}</p>`).join('') +
      `<p><a href="${SITE_URL}/standings">Full standings →</a></p>`,
    input.unsubscribeUrl
  )
  return { subject, html, text }
}

export interface TestEmailInput {
  displayName: string
  unsubscribeUrl: string
}

/** Admin-triggered deliverability check; sent regardless of the player's opt-out. */
export function testEmail(input: TestEmailInput): EmailContent {
  const subject = 'Test email — kpick3'
  const line =
    'This is a test email sent from the kpick3 admin panel. If you can read this, delivery to your inbox works.'
  const text = `Hey ${input.displayName},\n\n${line}\n\n${SITE_URL}\n\nUnsubscribe: ${input.unsubscribeUrl}\n`
  const html = layout(
    `<p>Hey ${esc(input.displayName)},</p><p>${line}</p><p><a href="${SITE_URL}">kpick3.com →</a></p>`,
    input.unsubscribeUrl
  )
  return { subject, html, text }
}

export interface FlaggedGameLine {
  week: number
  awayTeamAbbr: string
  homeTeamAbbr: string
}

export function needsReviewEmail(flagged: FlaggedGameLine[]): EmailContent {
  const subject = `⚠ ${flagged.length} game${flagged.length === 1 ? '' : 's'} need review — kpick3`
  const lines = flagged.map((g) => `Week ${g.week}: ${g.awayTeamAbbr} @ ${g.homeTeamAbbr}`)
  const text = `${lines.join('\n')}\n\nConfirm the finals: ${SITE_URL}/admin\n`
  const html = layout(
    `<p>These games went final with a missing or suspect score and picks are ungraded until you confirm:</p>` +
      `<ul style="padding-left:20px">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` +
      `<p><a href="${SITE_URL}/admin" style="font-weight:bold">Review in /admin →</a></p>`,
    null
  )
  return { subject, html, text }
}
