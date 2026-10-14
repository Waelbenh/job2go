import type { Job } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ScoreRing } from './ScoreRing'
import { StatusPill, TagList } from './Tag'

interface JobRowProps {
  job: Job
  onOpen?: (job: Job) => void
  animatedRing?: boolean
  className?: string
}

/** One job in a list, like a line on a departure board: score, title, where, 3 key tags.
 *  It adapts to the width of its list (container queries), not the screen. */
export function JobRow({ job, onOpen, animatedRing = true, className }: JobRowProps) {
  return (
    <article
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(job) : undefined}
      onKeyDown={onOpen ? (e) => e.key === 'Enter' && onOpen(job) : undefined}
      className={cn(
        'grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-md px-4 py-3',
        '@2xl:grid-cols-[auto_1fr_auto]',
        onOpen && 'cursor-pointer hover:bg-charcoal-800',
        className,
      )}
    >
      <ScoreRing score={job.score} animated={animatedRing} />
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 truncate font-semibold">
          {job.new && (
            <span className="rounded-sm bg-go-500 px-1.5 py-px text-[0.6875rem] font-bold text-charcoal-950">New</span>
          )}
          <span className="truncate">{job.title}</span>
        </h3>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-small text-ink-muted">
          <span className="text-ink">{job.company}</span>
          <span>{job.location || 'Location not stated'}</span>
          <span>via {job.source}</span>
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 @2xl:col-start-3 @2xl:justify-end">
        <StatusPill status={job.status} />
        <TagList tags={job.key_tags} />
      </div>
    </article>
  )
}
