import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

// One loop of the hero's little scene (milliseconds from the start). Calm: "Pack ready" stays 5 s.
const T_ARRIVE = 2600
const T_WORKING = 5200
const T_READY = 7400
const T_RESTART = T_READY + 5000

/** The hero scene: ring fills -> a new job arrives -> a pack is made -> start again.
 *  Runs only while `active` (e.g. on screen). With reduced motion it shows the end state. */
export function useHeroScene(active: boolean) {
  const reduceMotion = useReducedMotion()
  const [loop, setLoop] = useState(0)
  const [arrived, setArrived] = useState(false)
  const [packState, setPackState] = useState<'none' | 'working' | 'ready'>('none')
  useEffect(() => {
    if (reduceMotion || !active) return
    const timers = [
      setTimeout(() => setArrived(true), T_ARRIVE),
      setTimeout(() => setPackState('working'), T_WORKING),
      setTimeout(() => setPackState('ready'), T_READY),
      setTimeout(() => {
        setArrived(false)
        setPackState('none')
        setLoop((n) => n + 1)
      }, T_RESTART),
    ]
    return () => timers.forEach(clearTimeout)
  }, [active, reduceMotion, loop])
  return {
    loop,
    arrived: reduceMotion || arrived,
    packState: reduceMotion ? ('ready' as const) : packState,
  }
}
