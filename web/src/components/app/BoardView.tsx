import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { ScoreRing } from '@/components/job/ScoreRing'
import type { Job } from '@/lib/types'
import { scoreColor } from '@/lib/score'
import { cn } from '@/lib/utils'
import { locale, t } from '@/i18n'

export interface BoardColumn {
  column: string
  jobs: Job[]
  /** the real app: the status a job gets when it is dropped here */
  status?: string
}

/** The /app Board: one column per status. A card that changes column glides there (layoutId).
 *  With `onMove` (the real app) cards can be dragged to another column, or moved with the
 *  left / right arrow keys; Enter opens the job. Without it (the showcase) it is a picture. */
export function BoardView({ columns, highlight, compact = false, className, onMove, onOpen }: {
  columns: BoardColumn[]
  /** the card to mark (e.g. the one just moved) */
  highlight?: number
  /** narrow boards (phones): score as a small number instead of a ring, titles may wrap */
  compact?: boolean
  className?: string
  onMove?: (job: Job, status: string) => void
  onOpen?: (job: Job) => void
}) {
  const reduceMotion = useReducedMotion()
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const findJob = (n: number) => columns.flatMap((c) => c.jobs).find((j) => j.n === n)

  /** Arrow keys: move the card to the column on the left / right */
  function onKey(e: React.KeyboardEvent, job: Job, index: number) {
    if (e.key === 'Enter') return onOpen?.(job)
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const target = columns[index + step]
    if (step && target?.status && onMove) {
      e.preventDefault()
      onMove(job, target.status)
    }
  }

  return (
    <LayoutGroup>
      <div className={cn('grid auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-3', className)}>
        {columns.map(({ column, jobs, status }, index) => (
          <section
            key={column}
            data-board-column={column}
            aria-label={t('{column}, {n} jobs', { column: t(column), n: jobs.length })}
            className={cn('flex flex-col gap-2 rounded-lg bg-charcoal-850/70 p-2.5 transition-[box-shadow,background-color] duration-200',
              onMove && 'min-h-40', over === column && 'bg-charcoal-850 shadow-glow-go')}
            onDragOver={onMove && status ? (e) => { e.preventDefault(); setOver(column) } : undefined}
            onDragLeave={onMove ? () => setOver((o) => (o === column ? null : o)) : undefined}
            onDrop={onMove && status ? (e) => {
              e.preventDefault()
              setOver(null)
              setDragging(null) // the card moves to a new column, so its own dragend may never come
              const job = findJob(Number(e.dataTransfer.getData('text/plain')))
              if (job && job.status !== status) onMove(job, status)
            } : undefined}
          >
            <h3 className="flex items-center justify-between px-1.5 pt-1 text-small font-semibold">
              {t(column)}
              <span className="font-mono text-[0.75rem] text-ink-muted tabular">{jobs.length}</span>
            </h3>
            {jobs.map((job) => (
              // motion moves the card between columns; the plain div inside does the dragging
              // (motion uses onDragStart for its own kind of drag, so native drag lives one level down)
              <motion.article
                key={job.n}
                layoutId={reduceMotion ? undefined : `board-${job.n}`}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  className={cn(
                    'flex gap-3 rounded-md bg-charcoal-800 p-3 shadow-depth-1',
                    highlight === job.n && 'shadow-glow-go',
                    onMove && 'cursor-grab transition-opacity hover:bg-charcoal-700 active:cursor-grabbing',
                    dragging === job.n && 'opacity-40',
                  )}
                  {...(onMove && {
                    draggable: true,
                    tabIndex: 0,
                    role: 'button',
                    'aria-label': t('{title}, {company}. Arrow keys move it, Enter opens it.', { title: job.title, company: job.company }),
                    onDragStart: (e: React.DragEvent) => {
                      e.dataTransfer.setData('text/plain', String(job.n))
                      e.dataTransfer.effectAllowed = 'move'
                      setDragging(job.n)
                    },
                    onDragEnd: () => setDragging(null),
                    onClick: () => onOpen?.(job),
                    onKeyDown: (e: React.KeyboardEvent) => onKey(e, job, index),
                  })}
                >
                  {!compact && <ScoreRing score={job.score} animated={false} />}
                  <div className="min-w-0">
                    <p className={cn('text-small font-semibold', compact || onMove ? 'line-clamp-2' : 'truncate')}>
                      {compact && (
                        <span className="mr-1.5 font-mono text-[0.75rem] tabular" style={{ color: scoreColor(job.score) }}>
                          {job.score}
                        </span>
                      )}
                      {job.title}
                    </p>
                    <p className="truncate text-[0.75rem] text-ink-muted">{job.company}</p>
                    {job.applied_on && job.status !== 'pack ready' && (
                      <p className="mt-1 text-[0.75rem] text-ink-muted">
                        {t('Applied {date}', { date: shortDate(job.applied_on) })}
                      </p>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </section>
        ))}
      </div>
    </LayoutGroup>
  )
}

/** "2026-01-15" -> "15 Jan" */
function shortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}
