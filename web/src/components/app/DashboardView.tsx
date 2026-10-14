import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { JobRow } from '@/components/job/JobRow'
import type { Job, Stats } from '@/lib/types'
import { BestMatch } from './BestMatch'

interface DashboardViewProps {
  stats: Stats
  best: Job
  newToday: Job[]
  packState?: 'none' | 'working' | 'ready'
  ringKey?: number
  /** show the full score breakdown in the best match */
  breakdown?: boolean
  /** extra rows shown above the new jobs (the showcase uses it for jobs being filtered out) */
  beforeList?: ReactNode
  /** the real app: open a job's side panel / make the best match's pack */
  onOpenJob?: (job: Job) => void
  onMakePack?: (job: Job) => void
  /** shown when there are no new jobs */
  emptyList?: ReactNode
  /** extra blocks under the list (the real app's small charts) */
  children?: ReactNode
}

/** The /app Dashboard: today's best match (the hero), then the other new jobs as a list. */
export function DashboardView({
  stats, best, newToday, packState, ringKey, breakdown, beforeList, onOpenJob, onMakePack, emptyList, children,
}: DashboardViewProps) {
  const reduceMotion = useReducedMotion()
  return (
    // @container sits OUTSIDE the padding, so the layout reacts to the real width of the page area
    <div className="@container">
      <div className="grid gap-8 p-6 @3xl:p-8">
        <header>
          <h1 className="font-wide text-display-m font-semibold">Today</h1>
          <p className="mt-1 text-ink-muted">
            <Num>{stats.new_today}</Num> new jobs since the last run, <Num>{stats.good}</Num> good matches,{' '}
            <Num>{stats.applied}</Num> applications sent.
          </p>
        </header>

        <BestMatch job={best} packState={packState} ringKey={ringKey} breakdown={breakdown}
          onOpen={onOpenJob && (() => onOpenJob(best))} onMakePack={onMakePack && (() => onMakePack(best))} />

        <section aria-labelledby="new-today" data-tour="list">
          <h2 id="new-today" className="mb-2 px-4 text-title font-semibold">New today</h2>
          {beforeList}
          <motion.ul layout={!reduceMotion} className="grid">
            <AnimatePresence initial={false}>
              {newToday.map((job) => (
                <motion.li
                  key={job.n}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: -10, backgroundColor: 'rgba(67,196,106,0.12)' }}
                  animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(67,196,106,0)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1], backgroundColor: { duration: 1.6 } }}
                  className="rounded-md border-b border-hairline last:border-0"
                >
                  <JobRow job={job} onOpen={onOpenJob} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
          {newToday.length === 0 && emptyList}
        </section>
        {children}
      </div>
    </div>
  )
}

/** A number in the mono font (numbers only, never words) */
function Num({ children }: { children: number }) {
  return <span className="font-mono text-[0.875em] text-ink tabular">{children}</span>
}
