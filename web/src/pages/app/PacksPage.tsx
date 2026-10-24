import { Download, ExternalLink, FileText, MessagesSquare, PenLine } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ScoreRing } from '@/components/job/ScoreRing'
import { Button } from '@/components/ui/button'
import { useBase, useData, useJobs } from '@/lib/dataSource'
import type { Job } from '@/lib/types'
import { cn } from '@/lib/utils'
import { JobPanel } from './JobPanel'
import { PackQuality, RemakePack } from './PackExtras'
import { t } from '@/i18n'

const DOCS = [
  { key: 'cv', label: 'CV', icon: FileText },
  { key: 'letter', label: 'Cover letter', icon: PenLine },
  { key: 'prep', label: 'Interview prep', icon: MessagesSquare },
] as const
type DocKey = (typeof DOCS)[number]['key']

/** /app/packs: every application pack. Left: the jobs; right: the open document, large. */
export function PacksPage() {
  const { data } = useJobs()
  const { fileUrl } = useData()
  const base = useBase()
  const { n } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<DocKey>('cv')
  const [panel, setPanel] = useState<number | null>(null)
  if (!data) return null

  const packs = data.jobs.filter((job) => job.files.cv || job.files.letter || job.files.prep)
  const current = packs.find((job) => job.n === Number(n)) ?? packs[0]
  if (!current) {
    return (
      <div className="mx-auto grid max-w-[40rem] gap-3 px-8 py-24">
        <h1 className="font-wide text-display-m font-semibold">{t('No packs yet')}</h1>
        <p className="text-ink-muted">
          {t('Open a job in')} <Link to={`${base}/jobs`} className="text-score-good underline-offset-4 hover:underline">{t('Jobs')}</Link>{' '}
          {t('and press Make application pack. Its CV, letter and interview prep show up here.')}
        </p>
      </div>
    )
  }
  const shown = current.files[doc] ? doc : DOCS.find((d) => current.files[d.key])!.key
  const file = current.files[shown]!

  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden md:grid-cols-[19rem_1fr] md:grid-rows-1">
      {/* ---- The jobs with a pack ---- */}
      <nav aria-label={t('Packs')} className="max-h-56 overflow-y-auto border-b border-hairline p-4 md:max-h-none md:border-r md:border-b-0">
        <h1 className="px-2 pt-2 pb-4 font-wide text-title font-semibold">
          {t('Packs')} <span className="font-mono text-num text-ink-muted tabular">{packs.length}</span>
        </h1>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
          {packs.map((job) => (
            <li key={job.n}>
              <button type="button" onClick={() => navigate(`${base}/packs/${job.n}`)}
                aria-current={job.n === current.n ? 'page' : undefined}
                className={cn('flex w-full items-center gap-3 overflow-hidden rounded-md p-2.5 text-left transition-colors hover:bg-charcoal-800',
                  job.n === current.n && 'bg-charcoal-800 shadow-depth-1')}>
                <Quality job={job} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold">{job.title}</span>
                  <span className="block truncate text-[0.75rem] text-ink-muted">{job.company}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ---- The open document ---- */}
      <section aria-label={t('Open document')} className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-hairline px-6 py-4">
          <div className="min-w-0 basis-full">
            <h2 className="truncate font-wide text-title font-semibold">{current.title}</h2>
            <p className="text-small text-ink-muted">{current.company}</p>
            <div className="mt-1"><PackQuality job={current} /></div>
          </div>
          <div className="flex gap-1 rounded-md bg-charcoal-850 p-1 shadow-depth-1" role="tablist" aria-label={t('Document')}>
            {DOCS.filter((d) => current.files[d.key]).map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={shown === key} onClick={() => setDoc(key)}
                className={cn('flex items-center gap-2 rounded-sm px-3 py-1.5 text-small transition-colors',
                  shown === key ? 'bg-charcoal-700 text-ink' : 'text-ink-muted hover:text-ink')}>
                <Icon className="size-4" aria-hidden /> {t(label)}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <RemakePack job={current} size="sm" />
            <Button variant="secondary" size="sm" asChild>
              <a href={fileUrl(file)} download><Download aria-hidden /> {t('Download')}</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={fileUrl(file)} target="_blank" rel="noreferrer">{t('New tab')} <ExternalLink aria-hidden /></a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPanel(current.n)}>{t('Open job')}</Button>
          </div>
        </header>
        {/* PDFs and the prep sheet are served by serve.py (only files inside data/applications/) */}
        <iframe key={file} src={fileUrl(file)} title={`${current.title}: ${shown}`} className="min-h-0 flex-1 bg-charcoal-950" />
      </section>
      <JobPanel number={panel} onClose={() => setPanel(null)} />
    </div>
  )
}

/** The pack's recruiter-review score (tailor.py), as a small ring; "–" for older packs without one */
function Quality({ job }: { job: Job }) {
  const quality = Number.parseFloat(job.quality)
  return <ScoreRing score={Number.isNaN(quality) ? 0 : Math.round(quality)} animated={false} />
}
