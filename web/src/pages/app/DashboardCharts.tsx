import { useEffect, useState } from 'react'
import { useData, type Usage } from '@/lib/dataSource'
import type { PageData } from '@/lib/types'
import { scoreColor } from '@/lib/score'

/** The Dashboard's three small charts. Each is one series, so the title names it (no legend);
 *  every bar shows its exact number on hover, and the important numbers are written out. */
export function DashboardCharts({ charts, funnel }: { charts: PageData['charts']; funnel?: PageData['funnel'] }) {
  return (
    <div className="grid gap-4 @4xl:grid-cols-2 @6xl:grid-cols-[5fr_4fr_4fr]">
      {funnel && <WeekFunnel funnel={funnel} />}
      <Panel title="Where your jobs come from">
        <SourceBars rows={charts.sources} />
      </Panel>
      <Panel title="Scores of all jobs">
        <Columns rows={charts.scores.map(([score, count]) => ({ label: String(score), value: count, color: scoreColor(score) }))}
          labelEvery={1} hint={(r) => `Score ${r.label}: ${r.value} jobs`} />
      </Panel>
      <Panel title="Applications per week">
        <Columns rows={charts.weeks.map(([week, count]) => ({ label: week, value: count, color: 'var(--color-go-500)' }))}
          labelEvery={charts.weeks.length - 1} hint={(r) => `Week of ${r.label}: ${r.value} sent`} />
      </Panel>
      <UsagePanel />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-charcoal-850 p-5 shadow-depth-2">
      <h2 className="text-small font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Horizontal bars, biggest first: name, bar, number */
function SourceBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v))
  return (
    <ul className="grid gap-2">
      {rows.map(([name, value]) => (
        <li key={name} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-small" title={`${name}: ${value} jobs`}>
          <span className="truncate text-ink-muted">{name}</span>
          <span className="h-2 rounded-r-[4px] bg-ink-muted/55" style={{ width: `${Math.max(1.5, (value / max) * 100)}%` }} />
          <span className="text-right font-mono text-[0.75rem] text-ink tabular">{value}</span>
        </li>
      ))}
    </ul>
  )
}

interface Column { label: string; value: number; color: string }

/** Vertical bars on one baseline. The tallest bar's number is written above it. */
function Columns({ rows, labelEvery, hint }: { rows: Column[]; labelEvery: number; hint: (r: Column) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const top = rows.findIndex((r) => r.value === max && max > 0)
  return (
    <div>
      <div className="mt-5 flex h-28 items-end gap-0.5 border-b border-charcoal-700">
        {rows.map((r, i) => (
          // the hover area is the whole column, taller than the bar
          <div key={r.label} className="group relative flex h-full flex-1 items-end" title={hint(r)}>
            {i === top && (
              <span className="absolute inset-x-0 font-mono text-[0.6875rem] text-ink tabular text-center"
                style={{ bottom: `calc(${(r.value / max) * 100}% + 4px)` }}>{r.value}</span>
            )}
            <span className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{ height: r.value ? `max(3px, ${(r.value / max) * 100}%)` : 0, background: r.color }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {rows.map((r, i) => (
          <span key={r.label} className="flex-1 text-center font-mono text-[0.6875rem] text-ink-muted tabular">
            {i % labelEvery === 0 || i === rows.length - 1 ? r.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Today's AI usage: how much of Claude's daily scoring cap is used, and which Gemini models are available */
export function UsagePanel() {
  const api = useData()
  const [usage, setUsage] = useState<Usage | null>(null)
  useEffect(() => {
    api.usage().then(setUsage, () => setUsage(null))
  }, [api])
  if (!usage) return null
  const share = usage.claude_cap ? Math.min(1, usage.claude_used / usage.claude_cap) : 1
  return (
    <section className="rounded-lg bg-charcoal-850 p-5 shadow-depth-2">
      <h2 className="text-small font-semibold">AI usage today</h2>
      <div className="mt-4 grid gap-3 text-small">
        <div>
          <p className="flex justify-between gap-4">
            <span>Claude scoring</span>
            <span className="text-ink-muted">
              {usage.claude_on
                ? <><span className="font-mono text-ink tabular">{usage.claude_used}</span> of <span className="font-mono tabular">{usage.claude_cap}</span> jobs</>
                : 'switched off'}
            </span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-charcoal-700" title={`${Math.round(share * 100)}% of today's cap`}>
            <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: share >= 1 ? 'var(--color-score-low)' : share >= 0.8 ? 'var(--color-score-maybe)' : 'var(--color-go-500)' }} />
          </div>
        </div>
        {usage.gemini.map((g) => (
          <p key={g.role} className="flex justify-between gap-4" title={g.model}>
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${g.out ? 'bg-score-low' : 'bg-go-500'}`} aria-hidden /> Gemini, {g.role.toLowerCase()}
            </span>
            <span className="text-ink-muted">{g.out ? 'out of quota until tomorrow' : 'available'}</span>
          </p>
        ))}
      </div>
    </section>
  )
}

/** The last 7 days as a route: found -> filtered out (and why) -> scored -> good matches.
 *  It shows the agent's work: most jobs never reach you, and you see why. */
function WeekFunnel({ funnel }: { funnel: NonNullable<PageData['funnel']> }) {
  const dropped = funnel.filtered.reduce((sum, [, n]) => sum + n, 0)
  const steps: [string, number][] = [['Found', funnel.found], ['Filtered out', dropped], ['Scored by AI', funnel.scored], ['Score 7 or more', funnel.good]]
  const most = Math.max(1, ...funnel.filtered.map(([, n]) => n))
  return (
    <section className="rounded-lg bg-charcoal-850 p-5 shadow-depth-2 @4xl:col-span-2 @6xl:col-span-3">
      <h2 className="text-small font-semibold">The last {funnel.days} days</h2>
      <div className="mt-4 grid gap-6 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* the route: four stations on the green line */}
        <ol className="relative grid grid-cols-4">
          <span aria-hidden className="absolute top-[9px] right-[12.5%] left-[12.5%] h-0.5 rounded-full bg-go-500 shadow-[0_0_12px_var(--color-go-glow)]" />
          {steps.map(([label, value], i) => (
            <li key={label} className="relative grid justify-items-center gap-2 text-center">
              <span aria-hidden className={`size-5 rounded-full border-2 bg-charcoal-900 ${i === 3 ? 'border-go-500 shadow-glow-go' : 'border-go-500'}`} />
              <span className="font-mono text-[1.375rem] leading-none text-ink tabular">{value}</span>
              <span className="text-small text-ink-muted">{label}</span>
            </li>
          ))}
        </ol>
        {/* why jobs were dropped, for free, before any AI */}
        <ul className="grid content-start gap-2" aria-label="Why jobs were filtered out">
          {funnel.filtered.map(([reason, value]) => (
            <li key={reason} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-small" title={`${reason}: ${value} jobs`}>
              <span className="truncate text-ink-muted">{reason}</span>
              <span className="h-2 rounded-r-[4px] bg-score-low/70" style={{ width: `${Math.max(2, (value / most) * 100)}%` }} />
              <span className="text-right font-mono text-[0.75rem] text-ink tabular">{value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
