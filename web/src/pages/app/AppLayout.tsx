import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { AppBottomNav, AppSidebar, type AppPage } from '@/components/app/AppFrame'
import { AppTopBar } from '@/components/app/AppFrame'
import { Dialog } from '@/components/app/Dialog'
import { ToastProvider } from '@/components/app/Toast'
import { useToast } from '@/components/app/toast-context'
import { DataContext, JobsContext, useJobsLoader, type DataSource } from '@/lib/dataSource'
import { SearchContext } from './search'
import { AddJobDialog, RunSearchDialog } from './TopBarDialogs'
import { t } from '@/i18n'

const links = (base: string): Record<AppPage, string> => ({
  dashboard: base, jobs: `${base}/jobs`, board: `${base}/board`, packs: `${base}/packs`, profile: `${base}/profile`,
})

/** The app: sidebar + top bar stay; the page changes in the middle.
 *  `source` = where the data comes from: your real jobs (/app) or the sample data (/demo).
 *  `banner` = an optional slim bar at the very top (the demo says it is a demo). */
export function AppLayout({ source, base, banner }: { source: DataSource; base: string; banner?: ReactNode }) {
  const context = useMemo(() => ({ source, base }), [source, base])
  return (
    <DataContext.Provider value={context}>
      <ToastProvider>
        <Layout source={source} base={base} banner={banner} />
      </ToastProvider>
    </DataContext.Provider>
  )
}

function Layout({ source, base, banner }: { source: DataSource; base: string; banner?: ReactNode }) {
  const jobs = useJobsLoader(source)
  const toast = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirmRun, setConfirmRun] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const run = useSearchRun(source, jobs.reload, toast)

  const stats = jobs.data?.stats
  return (
    <JobsContext.Provider value={jobs}>
      <SearchContext.Provider value={query}>
        {banner}
        <div className={banner ? 'flex h-[calc(100dvh-2.5rem)] overflow-hidden' : 'flex h-dvh overflow-hidden'}>
          <div className="hidden md:block">
            <AppSidebar links={links(base)} logoHref={base === '/demo' ? '/' : base} counts={stats ? { jobs: stats.good, board: stats.applied } : {}} />
          </div>
          <AppBottomNav links={links(base)} />
          <div className="@container flex min-w-0 flex-1 flex-col">
            <AppTopBar
              search={
                <label className="flex h-9 flex-1 items-center gap-2 rounded-md bg-charcoal-850 px-3 shadow-depth-1 focus-within:shadow-glow-go @3xl:max-w-80">
                  <Search className="size-4 text-ink-faint" aria-hidden />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      navigate(`${base}/jobs`)
                    }}
                    placeholder={t('Search jobs and companies')}
                    aria-label={t('Search jobs and companies')}
                    className="min-w-0 flex-1 bg-transparent text-small text-ink outline-none placeholder:text-ink-faint"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} aria-label={t('Clear the search')} className="text-ink-faint hover:text-ink">
                      <X className="size-4" />
                    </button>
                  )}
                </label>
              }
              onAddJob={() => setAdding(true)}
              onRunSearch={() => setConfirmRun(true)}
              running={run.status}
              onRunClick={() => setShowRun(true)}
            />
            <main className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
              {jobs.error ? <ServerDown message={jobs.error} /> : <Outlet />}
            </main>
          </div>
        </div>
        <AddJobDialog open={adding} onClose={() => setAdding(false)} />
        <Dialog open={showRun && Boolean(run.status)} onClose={() => setShowRun(false)} title={t('Searching for jobs')}>
          <p className="text-small text-ink-muted">{t('The last lines the search printed. This closes by itself when it is done.')}</p>
          <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-charcoal-950 p-4 font-sans text-small leading-relaxed whitespace-pre-wrap text-ink-muted">
            {run.lines.map((l) => t(l)).join('\n') || t('Starting')}
          </pre>
        </Dialog>
        <RunSearchDialog open={confirmRun} onClose={() => setConfirmRun(false)} onStart={() => { setConfirmRun(false); void run.start() }} />
      </SearchContext.Provider>
    </JobsContext.Provider>
  )
}

/** "Run search": starts run.py, then follows its progress every 2 seconds until it ends */
function useSearchRun(api: DataSource, reload: () => Promise<void>, toast: (m: string, ok?: boolean) => void) {
  const [status, setStatus] = useState<{ label: string; progress: number } | undefined>()
  const [lines, setLines] = useState<string[]>([])
  const [watching, setWatching] = useState(false)

  const start = useCallback(async () => {
    const result = await api.runSearch()
    toast(result.message, result.ok)
    if (result.ok) setWatching(true)
  }, [toast, api])

  // If a search is already running when the page opens (e.g. started from the old page), follow it too
  useEffect(() => {
    api.runStatus().then((s) => s.running && setWatching(true)).catch(() => {})
  }, [api])

  useEffect(() => {
    if (!watching) return
    const timer = setInterval(async () => {
      try {
        const s = await api.runStatus()
        setLines(s.lines.slice(-14))
        const last = s.lines.filter((l) => l.trim()).at(-1) ?? 'Starting'
        // run.py does not say how far it is, so the bar shows the time spent (it fills in about 10 minutes)
        const minutes = parseInt(s.elapsed) || 0
        setStatus({ label: t(last).replace(/^[=\s-]+/, '').slice(0, 42), progress: Math.min(0.95, 0.05 + minutes / 10) })
        if (!s.running) {
          setWatching(false)
          setStatus(undefined)
          toast(s.code === 0 ? t('Search finished. Your jobs are up to date.') : t('The search stopped with an error. See the Terminal where serve.py runs.'), s.code === 0)
          void reload()
        }
      } catch {
        setWatching(false)
        setStatus(undefined)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [watching, reload, toast, api])

  return { status, start, lines }
}

function ServerDown({ message }: { message: string }) {
  return (
    <div className="mx-auto grid max-w-[40rem] gap-3 px-8 py-24">
      <h1 className="font-wide text-display-m font-semibold">{t('Your jobs could not load')}</h1>
      <p className="text-ink-muted">{t(message)}</p>
    </div>
  )
}
