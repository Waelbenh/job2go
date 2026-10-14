import type { BoardColumn } from '@/components/app/BoardView'
import { sampleBoard } from '@/demo/sampleData'

/** The sample board, before or after you mark the best match as applied. */
export function demoBoard(applied: boolean): BoardColumn[] {
  if (!applied) return sampleBoard
  const [fresh, ready, appliedCol, interview] = sampleBoard
  const best = ready.jobs[0]
  return [
    fresh,
    { column: ready.column, jobs: ready.jobs.slice(1) },
    { column: appliedCol.column, jobs: [{ ...best, status: 'applied', applied_on: '2026-01-15' }, ...appliedCol.jobs] },
    interview,
  ]
}

/** The best match's job number (the card that moves) */
export const MOVING_JOB = sampleBoard[1].jobs[0].n
