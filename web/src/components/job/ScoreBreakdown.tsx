import { AlertTriangle, Check, CircleHelp, Sprout } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { Job } from '@/lib/types'
import { cn } from '@/lib/utils'

// The 4 parts of a score, each with an icon + a word, so meaning never depends on color alone
const PARTS = [
  { key: 'strengths', label: 'Strengths', icon: Check, tone: 'text-go-400 bg-go-900', empty: 'Nothing noted' },
  { key: 'to_learn', label: 'To learn', icon: Sprout, tone: 'text-score-good bg-[#1b2a40]', empty: 'Nothing to learn' },
  { key: 'red_flags', label: 'Red flags', icon: AlertTriangle, tone: 'text-score-low bg-[#3a1d1b]', empty: 'None found' },
  { key: 'unknowns', label: 'Unknown', icon: CircleHelp, tone: 'text-ink-muted bg-charcoal-800', empty: 'Nothing missing' },
] as const

/** Why a job got its score: strengths, to learn, red flags, unknown. The AI writes each as "a; b; c". */
export function ScoreBreakdown({ job, animate = true, className }: { job: Job; animate?: boolean; className?: string }) {
  const reduceMotion = useReducedMotion()
  const appear = animate && !reduceMotion
  return (
    <div className={cn('grid gap-3 @2xl:grid-cols-2', className)}>
      {PARTS.map(({ key, label, icon: Icon, tone, empty }, i) => {
        const items = job[key].split(';').map((s) => s.trim()).filter(Boolean)
        return (
          <motion.section
            key={key}
            initial={appear ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: appear ? 0.12 * i : 0, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-md bg-charcoal-800/60 p-3"
          >
            <h4 className="flex items-center gap-2 text-small font-semibold">
              <span className={cn('grid size-5 place-items-center rounded-sm', tone)}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              {label}
            </h4>
            <ul className="mt-1.5 grid gap-0.5 text-small text-ink-muted">
              {items.length ? items.map((item) => <li key={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</li>)
                : <li>{empty}</li>}
            </ul>
          </motion.section>
        )
      })}
    </div>
  )
}
