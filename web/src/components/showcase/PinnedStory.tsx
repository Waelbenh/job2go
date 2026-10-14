import {
  AnimatePresence, motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue,
} from 'motion/react'
import { Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { AppSidebar, AppTopBar } from '@/components/app/AppFrame'
import { BoardView } from '@/components/app/BoardView'
import { DashboardView } from '@/components/app/DashboardView'
import { PackDocs } from '@/components/app/PackDocs'
import { ScoreBreakdown } from '@/components/job/ScoreBreakdown'
import { ScoreRing } from '@/components/job/ScoreRing'
import { Button } from '@/components/ui/button'
import { sampleArriving, sampleBestMatch, sampleNewToday, sampleStats } from '@/demo/sampleData'
import { useAfter } from '@/hooks/useAfter'
import { cn } from '@/lib/utils'
import { AppWindow } from './AppWindow'
import { demoBoard, MOVING_JOB } from './boardDemo'
import { useEntrance } from './entrance'
import { FilteredRows } from './FilteredRows'
import { HeroGlow, HeroText } from './Hero'
import { SearchRun } from './sources'
import { Station } from './Station'
import { TOUR_STEPS } from './tourSteps'
import { useHeroScene } from './useHeroScene'

// ---------------------------------------------------------------------------------------------
// The scroll story (wide screens, motion allowed). One tall section; inside it a "stage" that
// stays pinned to the screen (position: sticky) while you scroll:
//   start        the hero: headline on the left, the tilted app window on the right
//   grow         the window straightens and grows until it fills the screen; the hero text fades
//   5 steps      the window stays put. Each step lights up one part of the app (everything else
//                is dimmed) and a small card next to it explains it, with the green pipeline line.
// Distances are in "screens" of scrolling; scrollYProgress (0 -> 1 over the section) drives it all.
// ---------------------------------------------------------------------------------------------

const GROW = 1 // screens of scrolling to grow the window
const STEP_LEN = 1.1 // screens of scrolling per step
const TAIL = 0.4 // a little extra on the last step before the page moves on
const STEPS = TOUR_STEPS.length
const DIST = GROW + STEP_LEN * STEPS + TAIL // total scrolling distance, in screens
const SIDEBAR_W = 232
const TITLE_BAR = 40 // the window's title bar (h-10)
// The part of the app each step lights up (several = one box around all of them)
const TARGETS = [
  ['[data-tour="topbar"]', '[data-tour="search"]'],
  ['[data-tour="list"]'],
  ['[data-tour="panel"]'],
  ['[data-tour="panel"]'],
  ['[data-board-column="Pack ready"]', '[data-board-column="Applied"]'],
]

// Where the step card goes: under the lit-up part, or on its left (the side panel steps)
const CARD_SIDE = ['below', 'below', 'left', 'left', 'below'] as const
const FOLLOW = { stiffness: 90, damping: 22, mass: 1 } // the spotlight / card glide
const CROSSFADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25, ease: 'easeOut' },
} as const

interface Geometry {
  heroX: number; heroY: number; heroScale: number
  tourX: number; tourY: number; tourScale: number
  canvasW: number; canvasH: number
}
interface Box { x: number; y: number; w: number; h: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
/** The lit-up part of the app for this step, in app pixels inside the window body (null = not there yet) */
function measureSpot(windowEl: HTMLElement | null, step: number): Box | null {
  const body = windowEl?.querySelector<HTMLElement>('[data-window-body]')
  if (!body) return null
  const targets = TARGETS[step].map((sel) => body.querySelector<HTMLElement>(sel)).filter((t) => t !== null)
  if (!targets.length) return null
  const b = body.getBoundingClientRect()
  const s = b.width / body.offsetWidth // the window's current scale
  const rects = targets.map((t) => t.getBoundingClientRect())
  const pad = 10
  const left = Math.max(4, (Math.min(...rects.map((r) => r.left)) - b.left) / s - pad)
  const top = Math.max(4, (Math.min(...rects.map((r) => r.top)) - b.top) / s - pad)
  const right = Math.min(body.offsetWidth - 4, (Math.max(...rects.map((r) => r.right)) - b.left) / s + pad)
  const bottom = Math.min(body.offsetHeight - 4, (Math.max(...rects.map((r) => r.bottom)) - b.top) / s + pad)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** Where the step card goes (screen pixels): below the lit-up part, or on its left; always inside the window */
function placeCard(box: Box, g: Geometry, w: number, h: number, side: 'below' | 'left') {
  const inset = 16
  const gap = 16
  const s = g.tourScale
  const spot = {
    left: g.tourX + box.x * s,
    top: g.tourY + (TITLE_BAR + box.y) * s,
    bottom: g.tourY + (TITLE_BAR + box.y + box.h) * s,
  }
  const minX = g.tourX + inset
  const maxX = g.tourX + g.canvasW * s - inset - w
  const minY = g.tourY + inset
  const maxY = g.tourY + g.canvasH * s - inset - h
  return side === 'left'
    ? { x: clamp(spot.left - gap - w, minX, maxX), y: clamp(spot.top + 24, minY, maxY) }
    : { x: clamp(spot.left + 8, minX, maxX), y: clamp(spot.bottom + gap, minY, maxY) }
}

/** -1 = hero / growing, 0..4 = tour step */
const stepAt = (p: number) => {
  const d = p * DIST
  return d < GROW ? -1 : Math.min(STEPS - 1, Math.floor((d - GROW) / STEP_LEN))
}

export function PinnedStory() {
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const { group, item } = useEntrance()

  // ---- Where the window goes: measured from the screen size (and again on every resize) ----
  const geoRef = useRef<Geometry | null>(null)
  const [geo, setGeo] = useState<Geometry | null>(null)
  const geoTick = useMotionValue(0) // bumps when geo changes, so the motion values recalculate
  useLayoutEffect(() => {
    function measure() {
      if (!stage.current || !slot.current) return
      const st = stage.current.getBoundingClientRect()
      const sl = slot.current.getBoundingClientRect()
      // Tour: the window fills the screen below the floating nav (max 1600 px wide on huge screens).
      // The app inside is drawn 1120-1320 px wide, then scaled to fit, so text keeps a real size.
      const top = 88
      const bottom = 24
      const tourW = Math.min(st.width - 64, 1600)
      const canvasW = clamp(tourW, 1120, 1320)
      let tourScale = tourW / canvasW
      let canvasH = (st.height - top - bottom) / tourScale
      if (canvasH < 600) { // short screen: fit by height instead
        tourScale = (st.height - top - bottom) / 600
        canvasH = 600
      }
      const g: Geometry = {
        heroX: sl.left - st.left,
        heroY: sl.top - st.top,
        heroScale: Math.max(sl.width / 940, 0.86), // never smaller than 86%: text stays readable
        tourX: (st.width - canvasW * tourScale) / 2,
        tourY: top,
        tourScale, canvasW, canvasH,
      }
      geoRef.current = g
      setGeo(g)
      geoTick.set(geoTick.get() + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [geoTick])

  // Scrolling comes in jumps (a mouse wheel moves ~100 px at a time), so everything follows a softly
  // sprung copy of the scroll position: the window glides instead of jumping.
  const progress = useSpring(scrollYProgress, { stiffness: 170, damping: 32, restDelta: 0.00005 })

  // ---- GROW: 0 -> 1 during the first screen of scrolling (eased) ----
  const grow = useTransform(progress, (p) => easeInOut(clamp((p * DIST) / GROW, 0, 1)))
  const useGeo = (pick: (g: Geometry, t: number) => number) =>
    useTransform([grow, geoTick] as MotionValue<number>[], ([t]: number[]) => (geoRef.current ? pick(geoRef.current, t) : 0))
  const x = useGeo((g, t) => mix(g.heroX, g.tourX, t))
  const y = useGeo((g, t) => mix(g.heroY, g.tourY, t))
  const scale = useGeo((g, t) => mix(g.heroScale, g.tourScale, t))
  const rotateY = useTransform(grow, (t) => -5 * (1 - t))
  const rotateX = useTransform(grow, (t) => 1.5 * (1 - t))
  // the app's sidebar slides in from the left edge. (A negative margin, not a growing width with a clip:
  // Chrome would then skip painting the logo's SVG inside the 3D window and never repaint it.)
  const sidebarShift = useTransform(grow, (t) => -SIDEBAR_W * (1 - t))
  const fade = useTransform(grow, (t) => `linear-gradient(to bottom, #000 ${82 + 18 * t}%, transparent 100%)`)
  const heroOpacity = useTransform(grow, [0, 0.4], [1, 0])
  const heroY = useTransform(grow, [0, 0.4], [0, -40])
  const heroPointer = useTransform(heroOpacity, (o) => (o < 0.2 ? 'none' : 'auto'))
  // the green line in the step card: reaches station i exactly when step i begins
  const lineFill = useTransform(progress, (p) => clamp((p * DIST - GROW) / STEP_LEN / (STEPS - 1), 0, 1))

  // ---- Which step is on screen ----
  const [step, setStep] = useState(-1)
  useMotionValueEvent(progress, 'change', (p) => setStep(stepAt(p)))

  // ---- The spotlight (app pixels) and the step card (screen pixels) ----
  // They are motion values with a soft spring: on every frame while a step settles we measure the
  // lit-up part and set the target, so both glide along with the app instead of jumping.
  const spotX = useSpring(0, FOLLOW)
  const spotY = useSpring(0, FOLLOW)
  const spotW = useSpring(0, FOLLOW)
  const spotH = useSpring(0, FOLLOW)
  const cardX = useSpring(0, FOLLOW)
  const cardY = useSpring(0, FOLLOW)
  const shown = useSpring(0, { stiffness: 220, damping: 30 }) // 0 = hidden, 1 = shown
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (step < 0 || !geo) {
      shown.set(0)
      return
    }
    // already on screen: glide from the last step; otherwise appear right in place
    let placed = shown.get() > 0.05
    const started = performance.now()
    let frameId = 0
    const tick = () => {
      const box = measureSpot(windowRef.current, step)
      const card = cardRef.current
      if (box && card) {
        const pos = placeCard(box, geo, card.offsetWidth, card.offsetHeight, CARD_SIDE[step])
        const values: [MotionValue<number>, number][] = [
          [spotX, box.x], [spotY, box.y], [spotW, box.w], [spotH, box.h], [cardX, pos.x], [cardY, pos.y],
        ]
        values.forEach(([mv, v]) => (placed ? mv.set(v) : mv.jump(v)))
        placed = true
        shown.set(1)
      }
      if (performance.now() - started < 3200) frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [step, geo, spotX, spotY, spotW, spotH, cardX, cardY, shown])
  const spotlight = { x: spotX, y: spotY, width: spotW, height: spotH, opacity: shown }

  return (
    <section ref={section} aria-label="Job2go AI, and how it works" className="relative" style={{ height: `${(DIST + 1) * 100}vh` }}>
      {/* "See how it works" jumps here: the start of the steps */}
      <div id="how-it-works" aria-hidden className="absolute left-0" style={{ top: `${(GROW + 0.15) * 100}vh` }} />
      <div ref={stage} className="sticky top-0 h-screen overflow-hidden [perspective:2400px]">
        <HeroGlow />

        {/* The hero text (fades out as you scroll) and the slot where the window starts */}
        <motion.div variants={group} initial="hidden" animate="show"
          className="absolute inset-0 mx-auto grid max-w-[1200px] grid-cols-12 items-center gap-8 px-6 pt-16">
          <motion.div className="col-span-5" style={{ opacity: heroOpacity, y: heroY, pointerEvents: heroPointer }}>
            <HeroText item={item} />
          </motion.div>
          <div className="col-span-7 h-[62vh] pl-4">
            <div ref={slot} className="h-full w-full" />
          </div>
        </motion.div>

        {/* The app window: from the tilted hero position to filling the screen */}
        {geo && (
          <motion.div variants={item} initial="hidden" animate="show" className="absolute inset-0">
            <motion.div
              className="absolute top-0 left-0 origin-top-left"
              style={{ x, y, scale, rotateY, rotateX, width: geo.canvasW, height: geo.canvasH }}
            >
              <TourCanvas step={step} spotlight={spotlight} sidebarShift={sidebarShift} fade={fade} windowRef={windowRef} />
            </motion.div>
          </motion.div>
        )}

        {/* The step card: next to the lit-up part */}
        <StepCard ref={cardRef} step={step} x={cardX} y={cardY} shown={shown} lineFill={lineFill} />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// The app inside the window, in the state of the current step. Same components as /app.
// ---------------------------------------------------------------------------------------------
function TourCanvas({ step, spotlight, sidebarShift, fade, windowRef }: {
  step: number
  spotlight: Record<'x' | 'y' | 'width' | 'height' | 'opacity', MotionValue<number>>
  sidebarShift: MotionValue<number>
  fade: MotionValue<string>
  windowRef: RefObject<HTMLDivElement | null>
}) {
  const scene = useHeroScene(step === -1) // the hero's little loop, while the hero is on screen
  const content = useRef<HTMLDivElement>(null)

  // Step 0: the search runs (progress bar in the top bar), then the new job arrives in the list
  const searched = [useAfter(step === 0, 1500), useAfter(step === 0, 2300), useAfter(step === 0, 3300)]
  const searchProgress = (1 + searched.filter(Boolean).length) / 4
  const searchDone = searched[2]
  // Step 3: the pack is made, then its 3 documents appear; the best match shows "Pack ready"
  const packReady = useAfter(step === 3, 2000)
  // Step 4: you mark it as applied and it moves on the board
  const moved = useAfter(step === 4, 1100)

  const withArrival = [sampleArriving, ...sampleNewToday]
  const newToday =
    step === -1 ? (scene.arrived ? withArrival : sampleNewToday)
    : step === 0 ? (searchDone ? withArrival : sampleNewToday)
    : step === 1 ? withArrival.slice(0, 1) // the one the filters keep
    : withArrival
  const packState = step === -1 ? scene.packState : step === 3 ? (packReady ? 'ready' : 'working') : step === 4 ? 'ready' : 'none'
  const ringKey = step === -1 ? scene.loop : -1

  // ---- Step 1 pans the dashboard up, so the "New today" list sits right under the top bar ----
  const [listPan, setListPan] = useState(0)
  const pan = step === 1 ? listPan : 0
  useLayoutEffect(() => {
    if (step !== 1) return
    // measured against the dashboard itself: the morning search above it is still closing at this moment
    const dash = content.current?.querySelector<HTMLElement>('[data-dashboard]')
    const list = dash?.querySelector<HTMLElement>('[data-tour="list"]')
    if (!dash || !list) return
    const s = dash.getBoundingClientRect().width / dash.offsetWidth
    const offset = (list.getBoundingClientRect().top - dash.getBoundingClientRect().top) / s
    setListPan(Math.max(0, offset - 20))
  }, [step])

  return (
    <AppWindow ref={windowRef} className="h-full w-full" bodyStyle={{ maskImage: fade.get() }}>
      <MaskSync fade={fade} windowRef={windowRef} />
      <motion.div className="shrink-0" style={{ marginLeft: sidebarShift }}>
        <AppSidebar active={step === 4 ? 'board' : 'dashboard'} counts={{ jobs: sampleStats.good, board: sampleStats.applied }} />
      </motion.div>
      <div className="@container relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar
          running={step === 0 ? { label: searchDone ? `${sampleStats.new_today} new jobs found` : 'Searching 7 job sites', progress: searchProgress } : undefined}
        />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <motion.div
            ref={content}
            animate={{ y: -pan }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* the dashboard and the board crossfade, so the switch never jumps */}
            <AnimatePresence mode="wait" initial={false}>
              {step === 4 ? (
                <motion.div key="board" {...CROSSFADE} className="px-8 pt-6">
                  <h1 className="font-wide text-display-m font-semibold">Board</h1>
                  <p className="mt-1 text-ink-muted">Move a job when its status changes. Nothing is ever sent for you.</p>
                  <BoardView columns={demoBoard(moved)} highlight={moved ? MOVING_JOB : undefined} className="mt-5" />
                </motion.div>
              ) : (
                <motion.div key="dashboard" {...CROSSFADE} data-dashboard>
                  <DashboardView
                    stats={sampleStats}
                    best={sampleBestMatch}
                    newToday={newToday}
                    packState={packState}
                    ringKey={ringKey}
                    beforeList={step === 1 ? <FilteredRows play /> : null}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Step 0: the morning search drops in over the top of the dashboard (nothing below it moves) */}
          <AnimatePresence>
            {step === 0 && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 top-0 z-10 px-8 pt-6"
              >
                <SearchRun play className="shadow-depth-3 ring-1 ring-hairline" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Steps 2 and 3: the job's side panel slides in from the right (score, then the pack) */}
        <AnimatePresence>
          {(step === 2 || step === 3) && (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="@container absolute top-[57px] right-0 bottom-0 w-[520px] overflow-hidden border-l border-hairline bg-charcoal-900 p-7 shadow-depth-3"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  data-tour="panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  {step === 2 ? <ScorePanel /> : <PackPanel />}
                </motion.div>
              </AnimatePresence>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* The spotlight: one rounded hole, everything around it gently dimmed (no blur) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-20 rounded-lg"
        style={{ ...spotlight, boxShadow: '0 0 0 4000px rgb(14 15 17 / 0.48), 0 0 0 1.5px rgb(67 196 106 / 0.7), 0 0 32px rgb(67 196 106 / 0.2)' }}
      />
    </AppWindow>
  )
}

/** Keeps the window's bottom fade in sync with scrolling (a style motion value can't go on AppWindow directly). */
function MaskSync({ fade, windowRef }: { fade: MotionValue<string>; windowRef: RefObject<HTMLDivElement | null> }) {
  useMotionValueEvent(fade, 'change', (value) => {
    const body = windowRef.current?.querySelector<HTMLElement>('[data-window-body]')
    if (body) body.style.maskImage = value
  })
  return null
}

/** Step 2: the job's score, and why */
function ScorePanel() {
  const job = sampleBestMatch
  return (
    <>
      <p className="text-small text-ink-muted">Job details</p>
      <div className="mt-4 flex items-center gap-6">
        <ScoreRing score={job.score} size="lg" />
        <div className="min-w-0">
          <h2 className="font-wide text-title font-semibold">{job.title}</h2>
          <p className="mt-1 text-ink-muted">{job.company}</p>
          <p className="mt-3 text-small text-ink-muted">
            AI fit <span className="font-mono text-ink tabular">{job.fit}</span>, rules{' '}
            <span className="font-mono text-ink tabular">{job.adjustments.split(' ')[0]}</span>
          </p>
        </div>
      </div>
      <ScoreBreakdown job={job} className="mt-6 grid-cols-2" />
    </>
  )
}

const PACK_STEPS = ['Read the job', 'Matched your experience', 'Wrote CV and letter', 'Recruiter review']

/** Step 3: the application pack is made, one part after another */
function PackPanel() {
  const job = sampleBestMatch
  const done = [useAfter(true, 250), useAfter(true, 650), useAfter(true, 1050), useAfter(true, 1450)]
  const docs = [useAfter(true, 1700), useAfter(true, 2000), useAfter(true, 2300)].filter(Boolean).length
  return (
    <>
      <p className="text-small text-ink-muted">Application pack</p>
      <h2 className="mt-1 font-wide text-title font-semibold">{job.title}</h2>
      <p className="text-ink-muted">{job.company}</p>
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
        {PACK_STEPS.map((label, i) => (
          <li key={label} className={cn('flex items-center gap-2 text-small transition-colors duration-300', done[i] ? 'text-ink' : 'text-ink-faint')}>
            <span className={cn('grid size-4.5 place-items-center rounded-full transition-colors duration-300',
              done[i] ? 'bg-go-500 text-charcoal-950' : 'bg-charcoal-800')}>
              {done[i] && <Check className="size-3" strokeWidth={3} aria-hidden />}
            </span>
            {label}
          </li>
        ))}
      </ul>
      <PackDocs show={docs} className="mt-6 gap-4" />
      <div className="mt-6 flex gap-3">
        <Button>Open CV</Button>
        <Button variant="secondary">Download all</Button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// The step card: the step's title and short text, with the green pipeline line on top
// (5 stations; the line fills as you scroll). PinnedStory moves it next to the lit-up part.
// ---------------------------------------------------------------------------------------------
function StepCard({ step, x, y, shown, lineFill, ref }: {
  step: number
  x: MotionValue<number>
  y: MotionValue<number>
  shown: MotionValue<number>
  lineFill: MotionValue<number>
  ref: RefObject<HTMLDivElement | null>
}) {
  const current = TOUR_STEPS[Math.max(0, step)]
  const pointerEvents = useTransform(shown, (o) => (o > 0.5 ? 'auto' : 'none'))
  return (
    <motion.div
      ref={ref}
      className="absolute top-0 left-0 z-30 w-[372px] rounded-lg bg-charcoal-850 p-5 shadow-depth-3 ring-1 ring-hairline"
      style={{ x, y, opacity: shown, pointerEvents }}
      aria-live="polite"
    >
      <PipelineLine step={step} fill={lineFill} />
      <motion.div
        key={step}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h2 className="mt-4 font-wide text-title font-semibold">{current.title}</h2>
        <p className="mt-1.5 text-ink-muted">{current.text}</p>
        {step === STEPS - 1 && (
          <Button asChild className="mt-4">
            <a href="/demo">Try the demo</a>
          </Button>
        )}
      </motion.div>
    </motion.div>
  )
}

/** The signature: a small metro line with the 5 steps as stations. The green fill follows the scroll. */
function PipelineLine({ step, fill }: { step: number; fill: MotionValue<number> }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex flex-1 items-center justify-between" aria-hidden>
        <span className="absolute inset-x-[7px] h-0.5 rounded-full bg-charcoal-700" />
        <motion.span
          className="absolute inset-x-[7px] h-0.5 origin-left rounded-full bg-go-500 shadow-[0_0_12px_var(--color-go-glow)]"
          style={{ scaleX: fill }}
        />
        {TOUR_STEPS.map((s, i) => <Station key={s.id} small lit={i <= step} />)}
      </div>
      <p className="text-small text-ink-muted">
        Step <span className="font-mono text-ink tabular">{Math.max(1, step + 1)}</span> of{' '}
        <span className="font-mono tabular">{STEPS}</span>
      </p>
    </div>
  )
}
