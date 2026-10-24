import { motion, useInView, useReducedMotion } from 'motion/react'
import { CirclePlay, FileText, GraduationCap, HardDrive, Laptop, Lock, ShieldCheck } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ControlPreview, PackPreview, ScorePreview } from './StepPreviews'
import { t } from '@/i18n'

// "Features": five things Job2go does for you. Uneven rows (DESIGN.md: no grid of identical cards),
// each with a small live crop of the app that plays once when it scrolls into view.
// The last one, "Runs on your laptop", is the widest: privacy is the point of the whole design.

const FEATURES = [
  {
    title: 'Scores you can read',
    text: 'Every job gets a score from 1 to 10 with plain reasons: strengths, things to learn, red flags and unknowns. You set the rules: languages, location, level.',
    Visual: ({ play }: { play: boolean }) => <ScorePreview play={play} compact />,
    span: 'lg:col-span-7',
  },
  {
    title: 'A pack for every job',
    text: 'A tailored CV, cover letter and interview prep in one click. Each pack gets its own quality score, and you can remake it.',
    Visual: PackPreview,
    span: 'lg:col-span-5',
  },
  {
    title: 'Your board',
    text: 'Drag jobs from New to Applied to Offer and see where every application stands.',
    Visual: ControlPreview,
    span: 'lg:col-span-5',
  },
  {
    title: "Learn what's missing",
    text: 'A learning guide with free courses for the skills a job asks for, plus a one-week plan to be ready for the interview.',
    Visual: LearnPreview,
    span: 'lg:col-span-7',
  },
]

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 py-24 sm:px-6">
      <h2 id="features-title" className="font-wide text-display-m font-semibold lg:text-display-l">{t('Features')}</h2>
      <p className="mt-3 max-w-[52ch] text-body-l text-ink-muted">
        {t('Everything a job search needs, from the first ad to the interview, in one calm place.')}
      </p>
      <div className="mt-12 grid items-start gap-5 lg:grid-cols-12">
        {FEATURES.map(({ title, text, Visual, span }) => (
          <FeatureCard key={title} title={t(title)} text={t(text)} className={span} visual={(play) => <Visual play={play} />} />
        ))}
        <LocalCard />
      </div>
    </section>
  )
}

function FeatureCard({ title, text, visual, className }: {
  title: string
  text: string
  visual: (play: boolean) => ReactNode
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  return (
    <article ref={ref} className={cn('@container flex flex-col gap-6 rounded-xl bg-charcoal-850 p-6 shadow-depth-2 sm:p-7', className)}>
      <div>
        <h3 className="font-wide text-title font-semibold">{title}</h3>
        <p className="mt-2 max-w-[52ch] text-ink-muted">{text}</p>
      </div>
      {/* a live crop of the app: it is a picture, so it can't be clicked or tabbed into */}
      <div inert className="rounded-lg bg-charcoal-900/70 p-4 shadow-depth-1">{visual(inView)}</div>
    </article>
  )
}

/** "Learn what's missing": three free resources appear, then the week plan fills up */
function LearnPreview({ play }: { play: boolean }) {
  const reduceMotion = useReducedMotion()
  const animate = play && !reduceMotion
  const rows = [
    { icon: CirclePlay, where: 'YouTube', what: 'KYC process explained', cost: 'Free' },
    { icon: GraduationCap, where: 'Coursera', what: 'Financial markets basics', cost: 'Free to audit' },
    { icon: FileText, where: 'Official docs', what: 'Getting started with the CRM', cost: 'Free trial' },
  ]
  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {rows.map(({ icon: Icon, where, what, cost }, i) => (
          <motion.li
            key={what}
            initial={animate ? { opacity: 0, x: -10 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.42, delay: animate ? 0.2 + i * 0.18 : 0, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 rounded-md bg-charcoal-800 px-3 py-2 shadow-depth-1"
          >
            <Icon className="size-4 shrink-0 text-score-good" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-small"><span className="text-ink-muted">{t(where)}:</span> {t(what)}</span>
            <span className="shrink-0 text-[0.75rem] text-ink-muted">{t(cost)}</span>
          </motion.li>
        ))}
      </ul>
      <div className="flex items-center gap-3 px-1">
        <span className="text-small text-ink-muted">{t('One-week plan')}</span>
        <div className="flex flex-1 gap-1" aria-hidden>
          {Array.from({ length: 7 }, (_, d) => (
            <motion.span
              key={d}
              className="h-1.5 flex-1 rounded-full"
              initial={animate ? { backgroundColor: 'var(--color-charcoal-700)' } : false}
              animate={{ backgroundColor: 'var(--color-go-500)' }}
              transition={{ duration: 0.3, delay: animate ? 0.9 + d * 0.12 : 0 }}
            />
          ))}
        </div>
        <span className="font-mono text-[0.75rem] text-ink tabular">7</span>
      </div>
    </div>
  )
}

/** "Runs on your laptop": the widest card. Your files sit on the laptop; a lock clicks shut. */
function LocalCard() {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const reduceMotion = useReducedMotion()
  const animate = inView && !reduceMotion
  const files = ['Your profile', 'Your CVs and letters', 'Your applications', 'Your notes']
  return (
    <article
      ref={ref}
      className="relative overflow-hidden rounded-xl bg-charcoal-850 p-6 shadow-depth-2 ring-1 ring-go-500/30 sm:p-8 lg:col-span-12"
    >
      {/* the section's one soft light, behind the laptop */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-32 size-[28rem] rounded-full bg-go-500/10 blur-3xl" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
        <div>
          <h3 className="flex items-center gap-3 font-wide text-display-m font-semibold">
            <ShieldCheck className="size-7 shrink-0 text-go-400" aria-hidden /> {t('Runs on your laptop')}
          </h3>
          <p className="mt-3 max-w-[56ch] text-body-l text-ink-muted">
            {t('Job2go lives on your own computer. Your CV, profile and applications are stored locally and never uploaded to a Job2go server. Only the text of a job ad and what it needs from your profile go to the AI, the moment you ask for a score or a pack.')}
          </p>
        </div>
        <div inert className="mx-auto w-full max-w-[26rem]">
          {/* a simple laptop: screen with your files, a lock on top */}
          <div className="relative rounded-t-lg border border-charcoal-700 bg-charcoal-900 p-4 pt-8 shadow-depth-3">
            <motion.span
              className="absolute top-2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-go-900 text-go-400 shadow-glow-go"
              initial={animate ? { scale: 0.6, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: animate ? 0.9 : 0, ease: [0.16, 1, 0.3, 1] }}
            >
              <Lock className="size-4" aria-hidden />
            </motion.span>
            <ul className="grid gap-2">
              {files.map((name, i) => (
                <motion.li
                  key={name}
                  initial={animate ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: animate ? 0.15 + i * 0.12 : 0, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3 rounded-md bg-charcoal-800 px-3 py-2 text-small shadow-depth-1"
                >
                  <HardDrive className="size-4 shrink-0 text-ink-muted" aria-hidden />
                  <span className="flex-1">{t(name)}</span>
                  <span className="text-[0.75rem] text-go-400">{t('On this computer')}</span>
                </motion.li>
              ))}
            </ul>
          </div>
          <div className="mx-[-6%] h-3 rounded-b-xl border border-t-0 border-charcoal-700 bg-charcoal-800" />
          <p className="mt-3 flex items-center justify-center gap-2 text-small text-ink-muted">
            <Laptop className="size-4" aria-hidden /> {t('Your files stay on this computer')}
          </p>
        </div>
      </div>
    </article>
  )
}
