import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAfter } from '@/hooks/useAfter'
import { sampleStats } from '@/demo/sampleData'
import { cn } from '@/lib/utils'
import { SOURCES, type Source } from './sourceList'
import { Station } from './Station'
import { t } from '@/i18n'

/** One job site's logo tile: the official logo when there is one, otherwise its letters. */
export function SourceLogo({ source, size = 40 }: { source: Source; size?: number }) {
  return (
    <span
      role="img"
      aria-label={t('{name} logo', { name: source.name })}
      className="grid shrink-0 place-items-center rounded-[10px] font-bold text-white shadow-depth-1 ring-1 ring-white/10 ring-inset"
      style={{ width: size, height: size, background: source.color }}
    >
      {source.icon ? (
        <svg viewBox="0 0 24 24" className="size-[52%] fill-white" aria-hidden>
          <path d={source.icon} />
        </svg>
      ) : (
        <span aria-hidden className="leading-none tracking-tight" style={{ fontSize: size * (source.mark!.length > 2 ? 0.28 : 0.4) }}>
          {source.mark}
        </span>
      )}
    </span>
  )
}

const NEW_JOBS = sampleStats.new_today

/** "Runs on your computer": the morning search. The job sites light up, small green dots (jobs) drop
 *  out of each logo into the green pipeline line and flow along it to the count of new jobs.
 *  `play` starts it. Without play it waits; with reduced motion it shows the end state. */
export function SearchRun({ play, className }: { play: boolean; className?: string }) {
  const reduceMotion = useReducedMotion()
  const moving = play && !reduceMotion
  const finished = useAfter(moving, 3300) || !!reduceMotion

  // ---- Where the dots start (each logo) and where the line is: layout pixels, so scaling doesn't matter ----
  const box = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [paths, setPaths] = useState<{ x: number; y: number }[]>([])
  const [line, setLine] = useState({ y: 0, end: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const logos = [...el.querySelectorAll<HTMLElement>('[data-logo]')]
      setPaths(logos.map((l) => ({ x: l.offsetLeft + l.offsetWidth / 2, y: l.offsetTop + l.offsetHeight })))
      if (track.current) setLine({ y: track.current.offsetTop, end: track.current.offsetLeft + track.current.offsetWidth })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ---- The count of new jobs rolls up while the line fills ----
  const count = useMotionValue(reduceMotion ? NEW_JOBS : 0)
  const shown = useTransform(count, (v) => Math.round(v))
  useEffect(() => {
    if (reduceMotion) return count.set(NEW_JOBS)
    if (!play) return count.set(0)
    const run = animate(count, NEW_JOBS, { duration: 2.4, delay: 0.9, ease: [0.4, 0, 0.2, 1] })
    return () => run.stop()
  }, [play, reduceMotion, count])

  return (
    <section data-tour="search" className={cn('@container relative rounded-lg bg-charcoal-850 p-5 shadow-depth-2', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-small text-ink-muted">{t('Morning search, on your computer')}</p>
          <h3 className="mt-0.5 text-title font-semibold">{t('Reading 7 job sites')}</h3>
        </div>
        <p className="text-small text-ink-muted">
          {t('Every day at')} <span className="font-mono text-ink tabular">07:00</span>
        </p>
      </div>

      <div ref={box} className="relative mt-5">
        <ul className="grid grid-cols-4 gap-x-2 gap-y-4 @xl:grid-cols-7" aria-label={t('Job sites')}>
          {SOURCES.map((source, i) => (
            <motion.li
              key={source.name}
              initial={false}
              animate={moving ? { opacity: [0, 1], y: [10, 0], filter: ['blur(4px)', 'blur(0px)'] } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={moving ? { duration: 0.6, delay: 0.07 * i, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span data-logo>
                <SourceLogo source={source} />
              </span>
              <span className="text-[0.75rem] leading-tight text-ink-muted">{source.name}</span>
            </motion.li>
          ))}
        </ul>

        {/* The pipeline line: grey track, green fill, and the station where the new jobs arrive */}
        <div className="mt-6 flex items-center gap-3">
          <div ref={track} className="h-0.5 flex-1 rounded-full bg-charcoal-700">
            <motion.div
              className="h-full origin-left rounded-full bg-go-500 shadow-[0_0_14px_var(--color-go-glow)]"
              initial={false}
              animate={{ scaleX: moving ? [0, 1] : play || reduceMotion ? 1 : 0 }}
              transition={moving ? { duration: 2.4, delay: 0.9, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
            />
          </div>
          <Station lit={finished} />
          <p className="text-small whitespace-nowrap text-ink-muted">
            <motion.span className="font-mono text-ink tabular">{shown}</motion.span> {t('new jobs')}
          </p>
        </div>

        {/* Jobs = small green dots: down out of each logo, into the line, along it to the station */}
        {moving && line.end > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {paths.map((p, i) => (
              <motion.span
                key={i}
                className="absolute top-0 left-0 -mt-[3px] -ml-[3px] size-1.5 rounded-full bg-go-400 shadow-glow-go"
                initial={{ opacity: 0 }}
                animate={{ x: [p.x, p.x, p.x, line.end], y: [p.y, (p.y + line.y) / 2, line.y, line.y], opacity: [0, 1, 1, 0.2] }}
                transition={{
                  duration: 1.2 + (line.end - p.x) / 700,
                  delay: 0.9 + i * 0.16,
                  repeat: Infinity,
                  repeatDelay: 0.4 + (i % 3) * 0.25,
                  times: [0, 0.12, 0.28, 1],
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
