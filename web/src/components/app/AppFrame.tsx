import { Columns3, FileText, LayoutDashboard, ListFilter, Plus, Search, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export type AppPage = 'dashboard' | 'jobs' | 'board' | 'packs' | 'profile'

const NAV: { page: AppPage; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'jobs', label: 'Jobs', icon: ListFilter },
  { page: 'board', label: 'Board', icon: Columns3 },
  { page: 'packs', label: 'Packs', icon: FileText },
  { page: 'profile', label: 'My profile', icon: UserRound },
]

/** The quiet left sidebar of /app.
 *  `links` (the real app): each item is a link to its page. Without it (the showcase picture),
 *  the items are plain text and `active` says which one is lit. */
export function AppSidebar({ active, counts = {}, links, logoHref }: {
  active?: AppPage
  counts?: Partial<Record<AppPage, number>>
  links?: Record<AppPage, string>
  /** the real app: where the logo goes (the demo: back to the showcase) */
  logoHref?: string
}) {
  const itemClass = (on: boolean) =>
    cn('flex items-center gap-3 rounded-md px-3 py-2 text-ink-muted transition-colors',
      links && 'hover:bg-charcoal-800 hover:text-ink',
      on && 'bg-charcoal-800 text-ink shadow-depth-1')
  return (
    <nav aria-label={t('App')} className="flex h-full w-[232px] shrink-0 flex-col gap-1 border-r border-hairline bg-charcoal-950/40 px-3 py-5">
      {logoHref ? (
        <Link to={logoHref} className="mb-6 self-start rounded-md px-2" aria-label={t('Job2go AI home')}>
          <Logo />
        </Link>
      ) : (
        <Logo className="mb-6 px-2" />
      )}
      {NAV.map(({ page, label, icon: Icon }) => {
        const inside = (
          <>
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{t(label)}</span>
            {counts[page] !== undefined && <span className="font-mono text-[0.75rem] tabular">{counts[page]}</span>}
          </>
        )
        return links ? (
          <NavLink key={page} to={links[page]} end={page === 'dashboard'} className={({ isActive }) => itemClass(isActive)}>
            {inside}
          </NavLink>
        ) : (
          <span key={page} className={itemClass(page === active)}>{inside}</span>
        )
      })}
    </nav>
  )
}

/** The top bar of /app: search, add a job, run a search.
 *  `running` shows the live progress of "Run search" (label + 0..1).
 *  The real app passes `search` (a working search box) and the button actions; without them
 *  (the showcase picture) the bar is just drawn. */
export function AppTopBar({ children, running, search, onAddJob, onRunSearch, onRunClick }: {
  children?: ReactNode
  running?: { label: string; progress: number }
  search?: ReactNode
  onAddJob?: () => void
  onRunSearch?: () => void
  /** the real app: clicking the progress shows what run.py is doing */
  onRunClick?: () => void
}) {
  return (
    <header data-tour="topbar" className="flex items-center gap-3 border-b border-hairline px-6 py-3">
      {search ?? (
        <label className="flex h-9 flex-1 items-center gap-2 rounded-md bg-charcoal-850 px-3 text-ink-faint shadow-depth-1 @3xl:max-w-80">
          <Search className="size-4" aria-hidden />
          <span className="text-small">{t('Search jobs and companies')}</span>
        </label>
      )}
      {children}
      <Button variant="secondary" size="sm" className="hidden @xl:inline-flex" onClick={onAddJob}>
        <Plus /> {t('Add job')}
      </Button>
      {running ? (
        <button type="button" onClick={onRunClick} disabled={!onRunClick} title={onRunClick ? t('Show the details') : undefined}
          className="flex items-center gap-2.5 rounded-md bg-charcoal-800 px-3 py-1.5 text-small shadow-depth-1 enabled:hover:bg-charcoal-700">
          <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-charcoal-700">
            <span className="absolute inset-y-0 left-0 rounded-full bg-go-500 transition-[width] duration-500"
              style={{ width: `${Math.round(running.progress * 100)}%` }} />
          </span>
          {running.label}
        </button>
      ) : (
        <Button size="sm" onClick={onRunSearch}>{t('Run search')}</Button>
      )}
    </header>
  )
}

/** Phones: the sidebar's pages as a bar at the bottom of the screen */
export function AppBottomNav({ links }: { links: Record<AppPage, string> }) {
  return (
    <nav aria-label={t('App')} className="glass fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 rounded-lg p-1 md:hidden">
      {NAV.map(({ page, label, icon: Icon }) => (
        <NavLink key={page} to={links[page]} end={page === 'dashboard'}
          className={({ isActive }) => cn('flex flex-col items-center gap-0.5 rounded-md py-1.5 text-[0.6875rem] text-ink-muted',
            isActive && 'bg-charcoal-800 text-ink')}>
          <Icon className="size-4" aria-hidden />
          {t(label === 'My profile' ? 'Profile' : label)}
        </NavLink>
      ))}
    </nav>
  )
}
