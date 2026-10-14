import { useState } from 'react'
import { Link } from 'react-router'
import { DashboardView } from '@/components/app/DashboardView'
import { useBase, useJobs } from '@/lib/dataSource'
import type { Job } from '@/lib/types'
import { DashboardCharts } from './DashboardCharts'
import { JobPanel } from './JobPanel'

const SHOW_NEW = 8 // new jobs listed here; the rest are in Jobs

/** /app: today's best match (the hero), the other new jobs, and the small charts */
export function DashboardPage() {
  const { data } = useJobs()
  const base = useBase()
  const [open, setOpen] = useState<number | null>(null)
  if (!data) return null

  // Best match: the first job of the Good tab that is still open (report.py sorts it: new first,
  // then Trusted, then score). The "New today" list shows the other new jobs.
  const good = data.jobs.filter((j) => j.tab === 'good' && (j.status === 'new' || j.status === 'pack ready'))
  const best = good[0]
  const fresh = data.jobs.filter((j) => j.new && j.n !== best?.n)
  const packState = (job: Job) => (job.files.cv || job.status === 'pack ready' ? 'ready' : 'none')

  return (
    <div className="mx-auto max-w-[1100px]">
      {best ? (
        <DashboardView
          stats={data.stats}
          best={best}
          newToday={fresh.slice(0, SHOW_NEW)}
          packState={packState(best)}
          onOpenJob={(job) => setOpen(job.n)}
          onMakePack={(job) => setOpen(job.n)}
          emptyList={<p className="px-4 py-6 text-ink-muted">No other new jobs since the last search.</p>}
        >
          {fresh.length > SHOW_NEW && (
            <Link to={`${base}/jobs`} className="-mt-4 px-4 text-score-good underline-offset-4 hover:underline">
              See all {fresh.length} new jobs in Jobs
            </Link>
          )}
          <DashboardCharts charts={data.charts} funnel={data.funnel} />
        </DashboardView>
      ) : (
        <div className="grid gap-3 px-8 py-16">
          <h1 className="font-wide text-display-m font-semibold">Today</h1>
          <p className="text-ink-muted">No good matches to look at right now. Press Run search to look for new jobs.</p>
        </div>
      )}
      <JobPanel number={open} onClose={() => setOpen(null)} />
    </div>
  )
}
