import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import { scoreColor } from '@/lib/score'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const SIZES = {
  sm: { box: 40, stroke: 3, text: 'text-[0.8125rem]' },
  md: { box: 56, stroke: 4, text: 'text-[1.0625rem]' },
  lg: { box: 136, stroke: 7, text: 'text-num-xl' },
}

interface ScoreRingProps {
  score: number
  size?: keyof typeof SIZES
  /** false = show the final value at once (e.g. rings far down a long list) */
  animated?: boolean
  className?: string
}

/** A ring that fills up to score/10 while the number counts up (900 ms, once, when it scrolls into view). */
export function ScoreRing({ score, size = 'sm', animated = true, className }: ScoreRingProps) {
  const { box, stroke, text } = SIZES[size]
  const radius = (box - stroke) / 2
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduceMotion = useReducedMotion()
  const skip = !animated || reduceMotion

  const progress = useMotionValue(skip ? score : 0) // 0..10
  const shown = useTransform(progress, (v) => Math.round(v))
  const fill = useTransform(progress, (v) => v / 10)

  useEffect(() => {
    if (skip) {
      progress.set(score)
      return
    }
    if (!inView) return
    const run = animate(progress, score, { duration: 0.9, ease: [0.16, 1, 0.3, 1] })
    return () => run.stop()
  }, [inView, skip, score, progress])

  const color = scoreColor(score)
  const glow = size === 'lg' && score >= 8
  return (
    <div
      ref={ref}
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={score ? t('Score {n} out of 10', { n: score }) : t('Not scored yet')}
    >
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90" aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" stroke="var(--color-charcoal-700)" strokeWidth={stroke} />
        {score > 0 && (
          <motion.circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{ pathLength: fill, filter: glow ? 'drop-shadow(0 0 10px var(--color-go-glow))' : undefined }}
          />
        )}
      </svg>
      <motion.span className={cn('absolute font-mono font-medium tabular', text)} style={{ color }} aria-hidden>
        {score ? shown : '–'}
      </motion.span>
    </div>
  )
}
