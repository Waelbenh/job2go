import { useState } from 'react'
import { BoardView, type BoardColumn } from '@/components/app/BoardView'
import { useToast } from '@/components/app/toast-context'
import { useData, useJobs } from '@/lib/dataSource'
import type { Job } from '@/lib/types'
import { cn } from '@/lib/utils'
import { JobPanel } from './JobPanel'
import { t } from '@/i18n'

const COLUMNS = [
  { column: 'New', status: 'new' },
  { column: 'Pack ready', status: 'pack ready' },
  { column: 'Applied', status: 'applied' },
  { column: 'Interview', status: 'interview' },
  { column: 'Offer', status: 'offer' },
]
const FOLDED = [
  { column: 'Rejected', status: 'rejected' },
  { column: 'Not interested', status: 'not interested' },
]

/** /app/board: drag a job to another column to change its status (saved in data/jobs.csv) */
export function BoardPage() {
  const { data, reload } = useJobs()
  const api = useData()
  const toast = useToast()
  const [open, setOpen] = useState<number | null>(null)
  const [showFolded, setShowFolded] = useState(false)
  // Moves show at once; the saved state comes back with reload()
  const [moved, setMoved] = useState<Record<number, string>>({})
  const [last, setLast] = useState<number>()
  if (!data) return null

  const statusOf = (job: Job) => moved[job.n] ?? job.status
  // "New" = the good matches you haven't acted on (the Maybe tab stays in Jobs)
  const inColumn = (status: string) => data.jobs.filter((job) =>
    statusOf(job) === status && (status !== 'new' || job.tab === 'good' || job.tab === 'manual'))
  const columns: BoardColumn[] = [...COLUMNS, ...(showFolded ? FOLDED : [])]
    .map(({ column, status }) => ({ column, status, jobs: inColumn(status) }))

  async function move(job: Job, status: string) {
    setMoved((m) => ({ ...m, [job.n]: status }))
    setLast(job.n)
    const result = await api.setStatus(job.n, status)
    toast(result.message, result.ok)
    await reload()
    setMoved((m) => {
      const { [job.n]: _, ...rest } = m
      return rest
    })
  }

  const foldedCount = FOLDED.reduce((sum, f) => sum + inColumn(f.status).length, 0)
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-wide text-display-m font-semibold">{t('Board')}</h1>
          <p className="mt-1 text-ink-muted">{t('Drag a job when its status changes. Nothing is ever sent for you.')}</p>
        </div>
        <button type="button" onClick={() => setShowFolded(!showFolded)} aria-pressed={showFolded}
          className={cn('rounded-md px-3 py-1.5 text-small transition-colors hover:bg-charcoal-800',
            showFolded ? 'bg-charcoal-800 text-ink' : 'text-ink-muted')}>
          {showFolded ? t('Hide rejected and not interested') : t('Show rejected and not interested')}{' '}
          <span className="font-mono tabular">{foldedCount}</span>
        </button>
      </header>
      <div className="mt-6 overflow-x-auto pb-4">
        <BoardView columns={columns} highlight={last} onMove={move} onOpen={(job) => setOpen(job.n)}
          className="min-w-[60rem] items-start" />
      </div>
      <JobPanel number={open} onClose={() => setOpen(null)} />
    </div>
  )
}
