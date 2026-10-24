import { motion, type Variants } from 'motion/react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useEntrance } from './entrance'
import { HeroPreview } from './HeroPreview'

/** The headline, intro, buttons and note. Used by the normal hero and by the pinned scroll story. */
export function HeroText({ item }: { item: Variants }) {
  return (
    <>
      <motion.h1 id="hero-title" variants={item} className="font-wide">
        <span className="block text-[clamp(1.5rem,2.4vw,2.125rem)] leading-tight font-medium text-ink-muted">
          Your AI job assistant,
        </span>
        <span className="mt-1 block text-[clamp(3rem,5.6vw,4.375rem)] leading-[0.95] font-bold tracking-[-0.02em] whitespace-nowrap">
          ready to go.
        </span>
      </motion.h1>
      <motion.p variants={item} className="mt-7 max-w-[46ch] text-body-l text-ink-muted">
        Job2go reads new job ads every morning, scores each one against your profile, and writes a
        tailored CV and cover letter for the ones worth your time.
      </motion.p>
      <motion.div variants={item} className="mt-9 flex flex-wrap gap-3">
        <Button size="lg" asChild>
          <Link to="/demo">Try the demo</Link>
        </Button>
        <Button size="lg" variant="secondary" asChild>
          <a
            href="#how-it-works"
            onClick={(e) => {
              const target = document.getElementById('how-it-works')
              if (!target) return
              e.preventDefault()
              target.scrollIntoView({ behavior: 'smooth', block: 'start' })
              history.replaceState(null, '', '#how-it-works')
            }}
          >
            See how it works
          </a>
        </Button>
      </motion.div>
      <motion.p variants={item} className="mt-6 max-w-[46ch] text-small text-ink-muted">
        Runs on your computer. You stay in control and send every application yourself.
      </motion.p>
    </>
  )
}

/** Background layer 2: the page's one soft green light, behind the preview */
export function HeroGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-0 right-[-10%] h-[720px] w-[70%] bg-[radial-gradient(50%_50%_at_50%_45%,rgba(67,196,106,0.11),transparent_70%)]" />
  )
}

/** Showcase section 1 for phones and reduced motion: headline + the live-style app preview.
 *  (Wide screens with motion use PinnedStory, which shows the same hero and grows the preview.) */
export function Hero() {
  const { group, item } = useEntrance()
  return (
    <section aria-labelledby="hero-title" className="relative overflow-x-clip">
      <HeroGlow />
      <motion.div
        variants={group}
        initial="hidden"
        animate="show"
        className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:pt-24 lg:pb-32"
      >
        <div className="min-w-0 lg:col-span-5">
          <HeroText item={item} />
        </div>
        {/* The hero element: the app itself, slightly tilted and running off the right edge */}
        <motion.div variants={item} className="min-w-0 lg:col-span-7 lg:-mr-[max(0px,calc((100vw-1200px)/2))] lg:pl-4">
          <div className="lg:[transform:perspective(2400px)_rotateY(-5deg)_rotateX(1.5deg)] lg:origin-left">
            <HeroPreview />
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
