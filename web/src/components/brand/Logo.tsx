import { cn } from '@/lib/utils'

// The Job2go mark: the "2" drawn as a forward arrow (64 x 64 grid, green stroke, no fill).
// `stroke` can be thinner for tiny sizes (favicon, small icons), where 10 looks heavy.
function ArrowTwoPaths({ stroke = 10 }: { stroke?: number }) {
  return (
    <g transform="translate(4.5 4) scale(.92)" fill="none" stroke="#43c46a" strokeWidth={stroke}>
      <path d="M7 19C7 10 15 5 26 5S45 10 45 18C45 26 38 29.5 30 33.5L8 45H51" strokeLinejoin="round" />
      <path d="M44 36L53 45 44 54" strokeLinejoin="miter" />
    </g>
  )
}

/** The arrow-2 alone, trimmed to its ink, for use inside the word "Job2go" */
export function ArrowTwo({ className }: { className?: string }) {
  return (
    <svg viewBox="5 3 54 56" className={cn('inline-block shrink-0', className)} aria-hidden>
      <ArrowTwoPaths />
    </svg>
  )
}

/** App icon: the mark centered in a rounded charcoal square */
export function LogoIcon({ className, small = false }: { className?: string; small?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9 shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="15" fill="var(--color-charcoal-800)" />
      <g transform="translate(9.5 9) scale(.7)">
        <ArrowTwoPaths stroke={small ? 8.5 : 10} />
      </g>
    </svg>
  )
}

/** The wordmark: "Job" + the arrow-2 + "go", then "AI" in green. Real text, so it stays sharp and readable.
 *  The arrow-2 is 0.8em tall (its top lines up with the capitals) and sits on the baseline (its arrowhead dips a little below, like a "g").
 *  `showName={false}` shows the app icon only. */
export function Logo({ showName = true, className }: { showName?: boolean; className?: string }) {
  if (!showName) return <LogoIcon className={className} />
  return (
    <span className={cn('inline-flex items-baseline font-wide text-[1.25rem] leading-none font-[750] tracking-[-0.01em] text-ink', className)}>
      Job
      <span className="sr-only">2</span>
      <ArrowTwo className="relative top-[0.119em] mx-[0.04em] h-[0.8em] w-[0.771em]" />
      go
      <span className="ml-[0.32em] font-semibold text-go-500">AI</span>
    </span>
  )
}
