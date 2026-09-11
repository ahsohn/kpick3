/** ESPN team logo with an abbreviation tile fallback when the sync had no logo URL. */
export function TeamLogo({ src, abbr, small, board }: { src: string; abbr: string; small?: boolean; board?: boolean }) {
  const size = small ? 'h-4 w-4' : board ? 'h-7 w-7' : 'h-6 w-6'
  if (!src) {
    return (
      <span
        className={`flex ${size} shrink-0 items-center justify-center rounded-[5px] bg-tile text-[8px] font-extrabold`}
      >
        {abbr}
      </span>
    )
  }
  // Plain <img>: tiny CDN assets, no need for next/image's optimizer round-trip.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={abbr} className={`${size} shrink-0 object-contain`} loading="lazy" />
}
