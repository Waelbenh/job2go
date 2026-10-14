import { Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { ScoreBreakdown } from '@/components/job/ScoreBreakdown'
import { ScoreRing } from '@/components/job/ScoreRing'
import { StatusPill, TagList } from '@/components/job/Tag'
import { Button } from '@/components/ui/button'
import type { Job } from '@/lib/types'

/** The Dashboard's hero: the one job most worth your time today. */
export function BestMatch({ job, packState = 'none', ringKey, breakdown = false, onOpen, onMakePack }: {
  job: Job
  /** true = show strengths / to learn / red flags / unknown instead of the short list */
  breakdown?: boolean
  /** none = no pack yet, working = tailor.py is running, ready = pack made */
  packState?: 'none' | 'working' | 'ready'
  /** change it to replay the ring animation (used by the showcase loop) */
  ringKey?: number
  /** the real app: "Open job" opens the side panel, the main button makes the pack */
  onOpen?: () => void
  onMakePack?: () => void
}) {
  const reduceMotion = useReducedMotion()
  // The AI writes strengths as one line separated by ";" - show the first 3 as a list
  const strengths = job.strengths
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  return (
    <section
      aria-label="Today's best match"
      data-tour="best"
      className="relative overflow-hidden rounded-lg bg-charcoal-850 p-6 shadow-depth-2 @3xl:p-8"
    >
      {/* soft green light behind the ring: the page's one glow */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-go-500/10 blur-3xl" />
      <div className="relative grid gap-6 @3xl:grid-cols-[auto_1fr] @3xl:gap-8">
        <div className="flex items-center gap-4 @3xl:flex-col @3xl:items-start">
          <ScoreRing key={ringKey} score={job.score} size="lg" className="@max-3xl:scale-75 @max-3xl:-m-4" />
          <p className="text-small text-ink-muted @3xl:max-w-34">
            AI fit <span className="font-mono text-ink tabular">{job.fit}</span>, rules{' '}
            <span className="font-mono text-ink tabular">{job.adjustments.split(' ')[0]}</span>
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-small text-ink-muted">Today's best match</p>
          <h2 className="mt-1 font-wide text-display-m font-semibold">{job.title}</h2>
          <p className="mt-1.5 flex flex-wrap gap-x-4 text-ink-muted">
            <span className="text-ink">{job.company}</span>
            <span>{job.location}</span>
            <span>via {job.source}</span>
          </p>
          <TagList tags={job.key_tags} className="mt-4" />
          <p className="mt-4 max-w-[68ch] text-ink-muted">{job.summary}</p>
          {breakdown ? (
            <ScoreBreakdown job={job} className="mt-5" />
          ) : strengths.length > 0 && (
            <ul className="mt-4 grid gap-1.5">
              {strengths.map((s) => (
                <li key={s} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-go-500" />
                  {s}
                </li>
              ))}
            </ul>
          )}
          <div data-tour="pack-button" className="mt-6 flex min-h-11 flex-wrap items-center gap-3">
            {packState === 'ready' ? (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3"
              >
                <StatusPill status="pack ready" />
                <Button variant="secondary" onClick={onOpen}>View pack</Button>
              </motion.div>
            ) : packState === 'working' ? (
              <Button size="lg" variant="secondary" disabled className="disabled:opacity-100">
                <Loader2 className="animate-spin" aria-hidden /> Making application pack
              </Button>
            ) : (
              <Button size="lg" onClick={onMakePack}>Make application pack</Button>
            )}
            <Button variant="ghost" size="lg" onClick={onOpen}>Open job</Button>
          </div>
        </div>
      </div>
    </section>
  )
}
