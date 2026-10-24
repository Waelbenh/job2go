import { motion } from 'motion/react'
import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { JobRow } from '@/components/job/JobRow'
import { X } from 'lucide-react'
import { useToast } from '@/components/app/toast-context'
import { useBase, useData, useJobs } from '@/lib/dataSource'
import type { Job, JobTab } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useSearch } from './search'
import { JobPanel } from './JobPanel'
import { t } from '@/i18n'

const TABS: { tab: JobTab; label: string; empty: string }[] = [
  { tab: 'good', label: 'Good matches', empty: 'No good matches right now. Run a search to look for new jobs.' },
  { tab: 'maybe', label: 'Maybe', empty: 'Nothing in Maybe.' },
  { tab: 'manual', label: 'Added by you', empty: 'Jobs you add with "Add job" show up here.' },
  { tab: 'incomplete', label: 'Incomplete', empty: 'Every job has its full description.' },
  { tab: 'applied', label: 'Applied', empty: 'Jobs you mark as applied show up here.' },
  { tab: 'notint', label: 'Not interested', empty: 'Jobs you mark as not interested show up here.' },
]

/** /app/jobs: the list, in tabs. Clicking a row opens its side panel (/app/jobs/<number>). */
export function JobsPage() {
  const { data } = useJobs()
  const base = useBase()
  const query = useSearch().trim().toLowerCase()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { n } = useParams()
  const tab = (params.get('tab') as JobTab) || 'good'
  const place = params.get('place') || 'All'
  const minScore = Number(params.get('score') || 0)
  const source = params.get('source') || ''
  const { reload } = useJobs()
  const api = useData()
  const toast = useToast()

  // Where-filter: your home area first (Valencia for you, Lisbon in the demo), then Remote and Other
  const places = useMemo(() => {
    const groups = new Set((data?.jobs ?? []).map((j) => (j.loc_group === 'Unknown' ? 'Other' : j.loc_group)))
    const home = [...groups].filter((g) => g !== 'Remote' && g !== 'Other')
    return ['All', ...home, ...['Remote', 'Other'].filter((g) => groups.has(g))]
  }, [data])

  const sources = useMemo(() => [...new Set((data?.jobs ?? []).map((j) => j.source))].sort(), [data])

  const counts = useMemo(() => {
    const c: Partial<Record<JobTab, number>> = {}
    for (const job of data?.jobs ?? []) c[job.tab] = (c[job.tab] ?? 0) + 1
    return c
  }, [data])

  // While searching, every tab is searched; otherwise the open tab only
  const shown = useMemo(() => (data?.jobs ?? []).filter((job) =>
    (query ? matches(job, query) : job.tab === tab) &&
    (place === 'All' || job.loc_group === place || (place === 'Other' && job.loc_group === 'Unknown')) &&
    (!minScore || job.score >= minScore) && (!source || job.source === source)), [data, tab, place, query, minScore, source])
  const filtered = place !== 'All' || minScore > 0 || source !== ''

  /** The ✕ on a row: "Not interested" without opening the job */
  async function dismiss(job: Job) {
    const result = await api.notInterested(job.n)
    toast(result.message, result.ok)
    await reload()
  }

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const open = (job: Job) => navigate({ pathname: `${base}/jobs/${job.n}`, search: params.toString() })
  const close = () => navigate({ pathname: `${base}/jobs`, search: params.toString() })
  const current = TABS.find((x) => x.tab === tab) ?? TABS[0]

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-wide text-display-m font-semibold">{query ? t('Search') : t('Jobs')}</h1>
          <p className="mt-1 text-ink-muted">
            {query ? <>{t('Results for “{q}” in every tab.', { q: query })}</> : data ? <><span className="font-mono text-ink tabular">{data.stats.tracked}</span> {t('jobs tracked. Updated {when}.', { when: data.updated })}</> : t('Loading your jobs')}
          </p>
        </div>
        <div className="flex gap-1 rounded-md bg-charcoal-850 p-1 shadow-depth-1" role="group" aria-label={t('Where')}>
          {places.map((p) => (
            <button key={p} type="button" onClick={() => setParam('place', p)} aria-pressed={place === p}
              className={cn('rounded-sm px-3 py-1 text-small transition-colors', place === p ? 'bg-charcoal-700 text-ink' : 'text-ink-muted hover:text-ink')}>
              {t(p)}
            </button>
          ))}
        </div>
      </header>

      {/* More filters: lowest score, and where the job was found */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-small">
        <label className="flex items-center gap-2 text-ink-muted">{t('Score')}
          <select value={minScore} onChange={(e) => setParam('score', e.target.value === '0' ? '' : e.target.value)}
            className="rounded-sm bg-charcoal-850 px-2 py-1 text-ink shadow-depth-1 outline-none focus:shadow-glow-go">
            <option value="0">{t('Any')}</option>
            {[9, 8, 7, 6, 5].map((s) => <option key={s} value={s}>{t('{n} and up', { n: s })}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-ink-muted">{t('Found on')}
          <select value={source} onChange={(e) => setParam('source', e.target.value)}
            className="rounded-sm bg-charcoal-850 px-2 py-1 text-ink shadow-depth-1 outline-none focus:shadow-glow-go">
            <option value="">{t('All sites')}</option>
            {sources.map((s) => <option key={s} value={s}>{t(s)}</option>)}
          </select>
        </label>
        {filtered && (
          <button type="button" onClick={() => setParams(new URLSearchParams(tab ? { tab } : {}), { replace: true })}
            className="rounded-sm px-2 py-1 text-ink-muted transition-colors hover:bg-charcoal-800 hover:text-ink">
            {t('Clear filters')}
          </button>
        )}
      </div>

      {!query && (
        <nav aria-label={t('Job tabs')} className="mt-6 flex flex-wrap gap-x-1 gap-y-2 border-b border-hairline">
          {TABS.map(({ tab: id, label }) => (
            <button key={id} type="button" onClick={() => setParam('tab', id)} aria-current={tab === id ? 'page' : undefined}
              className={cn('relative flex items-center gap-2 px-3 pt-1 pb-3 transition-colors',
                tab === id ? 'text-ink' : 'text-ink-muted hover:text-ink')}>
              {t(label)}
              <span className="font-mono text-[0.75rem] tabular">{counts[id] ?? 0}</span>
              {tab === id && (
                <motion.span layoutId="tab-line" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-go-500"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} />
              )}
            </button>
          ))}
        </nav>
      )}

      <section aria-label={t(current.label)} className="@container mt-4">
        {tab === 'incomplete' && !query && (
          <p className="max-w-[68ch] px-4 pb-3 text-small text-ink-muted">
            {t('The job ad was missing or cut off and could not be downloaded. Open the job, copy its full text from the job page and use Add description: the job is then scored.')}
          </p>
        )}
        {data && shown.length === 0 && (
          <p className="px-4 py-12 text-ink-muted">{query ? t('Nothing matches your search.') : filtered ? t('No jobs match these filters.') : t(current.empty)}</p>
        )}
        <ul className="grid">
          {shown.map((job, i) => (
            <li key={job.n} className={cn('group relative border-b border-hairline last:border-0', Number(n) === job.n && 'rounded-md bg-charcoal-850')}>
              <JobRow job={job} onOpen={open} animatedRing={i < 8} className="pr-12" />
              {!['applied', 'notint', 'rejected'].includes(job.tab) && (
                <button type="button" onClick={() => dismiss(job)} aria-label={t('Not interested in {title}', { title: job.title })} title={t('Not interested')}
                  className="absolute top-3 right-2 grid size-8 place-items-center rounded-md text-ink-faint opacity-60 transition-[opacity,background-color,color] group-hover:opacity-100 hover:bg-charcoal-800 hover:text-score-low focus-visible:opacity-100">
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <JobPanel number={n ? Number(n) : null} onClose={close} />
    </div>
  )
}

function matches(job: Job, query: string): boolean {
  return [job.title, job.company, job.location, job.source, job.summary].some((text) => text.toLowerCase().includes(query))
}
