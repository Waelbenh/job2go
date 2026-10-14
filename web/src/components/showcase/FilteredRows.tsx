import { motion, useReducedMotion } from 'motion/react'
import { sampleFilteredOut } from '@/demo/sampleData'

/** Jobs the free filters drop: each shows its reason, then fades and is crossed out.
 *  `play` runs it; without play (or with reduced motion) the rows show their end state.
 *  On narrow lists the red reason wraps under the job instead of pushing the row wider. */
export function FilteredRows({ play }: { play: boolean }) {
  const reduceMotion = useReducedMotion()
  const animate = play && !reduceMotion
  return (
    <ul className="grid" aria-label="Jobs filtered out">
      {sampleFilteredOut.map(({ job, reason }, i) => (
        <li key={job.n} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-hairline px-4 py-3">
          {/* the job fades; its red reason stays readable */}
          <motion.div
            initial={animate ? { opacity: 1 } : false}
            animate={{ opacity: 0.4 }}
            transition={animate ? { duration: 0.6, delay: 0.9 + i * 0.45 } : { duration: 0 }}
            className="flex min-w-0 flex-1 basis-56 items-center gap-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-charcoal-700 font-mono text-[0.8125rem] text-ink-muted" aria-hidden>
              –
            </span>
            <div className="min-w-0 flex-1">
              <p className="relative w-fit max-w-full truncate font-semibold">
                {job.title}
                {/* the strike line draws across the title */}
                <motion.span
                  aria-hidden
                  className="absolute top-1/2 left-0 h-px w-full origin-left bg-ink-muted"
                  initial={animate ? { scaleX: 0 } : false}
                  animate={{ scaleX: 1 }}
                  transition={animate ? { duration: 0.4, delay: 1 + i * 0.45 } : { duration: 0 }}
                />
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-small text-ink-muted">
                <span>{job.company}</span>
                <span>{job.location}</span>
              </p>
            </div>
          </motion.div>
          <motion.span
            initial={animate ? { opacity: 0, scale: 0.9 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={animate ? { duration: 0.3, delay: 0.3 + i * 0.45 } : { duration: 0 }}
            className="ml-14 shrink-0 rounded-sm bg-[#3a1d1b] px-2 py-0.5 text-small whitespace-nowrap text-[#f4887e] @md:ml-0"
          >
            {reason}
          </motion.span>
        </li>
      ))}
    </ul>
  )
}
