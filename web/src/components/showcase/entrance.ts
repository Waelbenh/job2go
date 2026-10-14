import { useReducedMotion, type Variants } from 'motion/react'

/** The page's ONE staggered entrance: blur -> sharp, 60 ms apart (DESIGN.md, motion rule 1).
 *  `group` goes on the parent, `item` on each child that enters. */
export function useEntrance() {
  const reduceMotion = useReducedMotion()
  const group: Variants = { show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }
  const item: Variants = reduceMotion
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } }
    : {
        hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
      }
  return { group, item }
}
