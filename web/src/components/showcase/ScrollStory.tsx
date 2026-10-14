import { useReducedMotion } from 'motion/react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Hero } from './Hero'
import { PinnedStory } from './PinnedStory'
import { TourStacked } from './TourStacked'

/** The hero + "How it works".
 *  Wide screen with motion: the pinned scroll story (the window grows, then a guided tour).
 *  Phone, short screen or reduced motion: the normal hero, then the steps stacked (no pinning). */
export function ScrollStory() {
  const reduceMotion = useReducedMotion()
  const wide = useMediaQuery('(min-width: 1024px) and (min-height: 640px)')
  if (wide && !reduceMotion) return <PinnedStory />
  return (
    <>
      <Hero />
      <TourStacked />
    </>
  )
}
