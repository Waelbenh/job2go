import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { SearchRun } from './sources'
import { Station } from './Station'
import { ControlPreview, FilterPreview, PackPreview, ScorePreview } from './StepPreviews'
import { TOUR_STEPS } from './tourSteps'
import { t } from '@/i18n'

const PREVIEWS = [
  ({ play }: { play: boolean }) => <SearchRun play={play} className="-m-4 shadow-none sm:-m-5" />,
  FilterPreview,
  ScorePreview,
  PackPreview,
  ControlPreview,
]

/** "How it works" without pinning: the 5 steps stacked, each with its own small preview.
 *  Used on phones and whenever reduced motion is on (then every preview shows its end state). */
export function TourStacked() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="mx-auto max-w-[1200px] px-4 pt-8 pb-24 sm:px-6">
      <h2 id="how-title" className="font-wide text-display-m font-semibold lg:text-display-l">{t('How it works')}</h2>
      <p className="mt-3 max-w-[52ch] text-body-l text-ink-muted">
        {t('Five steps, from job ads to an application you send yourself.')}
      </p>
      <ol className="mt-12">
        {TOUR_STEPS.map((step, i) => {
          const Preview = PREVIEWS[i]
          return (
            <StackedStep key={step.id} last={i === TOUR_STEPS.length - 1} title={t(step.title)} text={t(step.text)}
              preview={(play) => <Preview play={play} />} />
          )
        })}
      </ol>
    </section>
  )
}

function StackedStep({ title, text, preview, last }: {
  title: string
  text: string
  preview: (play: boolean) => ReactNode
  last: boolean
}) {
  const ref = useRef<HTMLLIElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const reduceMotion = useReducedMotion()
  const lit = inView || !!reduceMotion
  return (
    <li ref={ref} className="relative grid grid-cols-[1.5rem_1fr] gap-x-5 pb-14">
      {/* this step's piece of the pipeline line: grey track, green fill when the step is reached */}
      {!last && (
        <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-charcoal-700">
          <motion.span
            className="absolute inset-0 origin-top bg-go-500 shadow-[0_0_12px_var(--color-go-glow)]"
            initial={false}
            animate={{ scaleY: lit ? 1 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </span>
      )}
      <Station lit={lit} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <h3 className="font-wide text-title font-semibold">{title}</h3>
          <p className="mt-2 max-w-[48ch] text-ink-muted">{text}</p>
        </div>
        <div className="rounded-lg bg-charcoal-850 p-4 shadow-depth-2 sm:p-5">{preview(lit)}</div>
      </div>
    </li>
  )
}
