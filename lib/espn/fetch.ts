const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

/**
 * NFL scoreboard. With no args ESPN returns the "current" week (which is the preseason
 * during August — callers filter to regular season). Pass season + week to fetch a
 * specific regular-season week; the season year must be pinned via `dates=` because
 * ESPN otherwise serves the *previous* season during the offseason.
 */
export async function fetchScoreboard(opts?: { season: number; week: number }): Promise<any> {
  const qs = opts ? `?dates=${opts.season}&seasontype=2&week=${opts.week}` : ''
  const res = await fetch(`${BASE}/scoreboard${qs}`, {
    // Always fetch fresh from ESPN inside the cron job.
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`)
  return res.json()
}

/**
 * Scoreboard fetch for render-time live-score overlays (not the cron). Opts into Next's
 * Data Cache with a short revalidate so concurrent page renders share one response and we
 * don't hit ESPN on every request — ESPN's own ~60s cache makes finer polling pointless.
 */
export async function fetchScoreboardCached(): Promise<any> {
  const res = await fetch(`${BASE}/scoreboard`, {
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`)
  return res.json()
}
