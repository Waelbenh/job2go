import { useReducedMotion } from 'motion/react'
import { BoardView } from '@/components/app/BoardView'
import { PackDocs } from '@/components/app/PackDocs'
import { JobRow } from '@/components/job/JobRow'
import { ScoreBreakdown } from '@/components/job/ScoreBreakdown'
import { ScoreRing } from '@/components/job/ScoreRing'
import { sampleBestMatch, sampleNewToday } from '@/demo/sampleData'
import { useAfter } from '@/hooks/useAfter'
import { demoBoard, MOVING_JOB } from './boardDemo'
import { FilteredRows } from './FilteredRows'

// The small preview of each step, for the stacked layout (phone, or reduced motion).
// Each one plays once when `play` turns true; with reduced motion it shows its end state.

export function FilterPreview({ play }: { play: boolean }) {
  return (
    <div className="@container">
      <FilteredRows play={play} />
      <JobRow job={sampleNewToday[0]} animatedRing={play} />
    </div>
  )
}

/** `compact`: the 4 parts of the score in two columns (wide cards, e.g. the Features section) */
export function ScorePreview({ play, compact = false }: { play: boolean; compact?: boolean }) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="@container grid gap-4">
      <div className="flex items-center gap-4">
        {play || reduceMotion ? <ScoreRing score={sampleBestMatch.score} size="md" /> : <div className="size-14" />}
        <div>
          <p className="font-semibold">{sampleBestMatch.title}</p>
          <p className="text-small text-ink-muted">{sampleBestMatch.company}</p>
        </div>
      </div>
      {(play || reduceMotion) && <ScoreBreakdown job={sampleBestMatch} className={compact ? 'sm:grid-cols-2' : undefined} />}
    </div>
  )
}

export function PackPreview({ play }: { play: boolean }) {
  const reduceMotion = useReducedMotion()
  const one = useAfter(play, 200)
  const two = useAfter(play, 650)
  const three = useAfter(play, 1100)
  const shown = reduceMotion ? 3 : [one, two, three].filter(Boolean).length
  return <PackDocs show={shown} />
}

export function ControlPreview({ play }: { play: boolean }) {
  const reduceMotion = useReducedMotion()
  const moved = useAfter(play, 1200) || !!reduceMotion
  // only the two columns the card moves between
  return <BoardView columns={demoBoard(moved).slice(1, 3)} highlight={moved ? MOVING_JOB : undefined}
    compact className="auto-cols-[minmax(0,1fr)]" />
}
