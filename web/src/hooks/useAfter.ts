import { useEffect, useState } from 'react'

/** Becomes true `ms` milliseconds after `active` turns true; false again as soon as it turns false.
 *  Used to play small steps one after another (e.g. "pack working" -> "pack ready"). */
export function useAfter(active: boolean, ms: number): boolean {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setDone(true), ms)
    return () => {
      clearTimeout(timer)
      setDone(false)
    }
  }, [active, ms])
  return active && done
}
