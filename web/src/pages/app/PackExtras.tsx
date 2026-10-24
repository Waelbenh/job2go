import { BookOpen, ExternalLink, Loader2, RotateCcw, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/app/Dialog'
import { useToast } from '@/components/app/toast-context'
import { Button } from '@/components/ui/button'
import { useData, useJobs } from '@/lib/dataSource'
import type { Job, LearningGuide as Guide } from '@/lib/types'
import { inputClass } from './TopBarDialogs'
import { t, tList } from '@/i18n'

/** The pack's quality score, and a note when the polish step was skipped */
export function PackQuality({ job }: { job: Job }) {
  if (!job.quality && job.pack_polished !== false) return null
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-muted">
      {job.quality && <span>{t('Pack quality')} <span className="font-mono text-ink tabular">{job.quality}</span>/10</span>}
      {job.pack_polished === false && (
        <span className="inline-flex items-center gap-1.5 text-score-maybe">
          <TriangleAlert className="size-3.5" aria-hidden /> {t('Not polished, remake when Claude is available')}
        </span>
      )}
    </p>
  )
}

/** "Remake pack": asks first (it uses AI quota), with an optional note on what to do better.
 *  serve.py makes the new pack next to the old one and swaps it in only when it is complete. */
export function RemakePack({ job, onDone, size = 'lg' }: { job: Job; onDone?: () => void; size?: 'lg' | 'sm' }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const { reload } = useJobs()
  const api = useData()

  async function remake() {
    setOpen(false)
    setBusy(true)
    const result = await api.remakePack(job.n, note)
    setBusy(false)
    toast(result.message, result.ok)
    if (result.ok) setNote('')
    await reload()
    onDone?.()
  }

  return (
    <>
      <Button variant="secondary" size={size} disabled={busy} onClick={() => setOpen(true)}>
        {busy ? <><Loader2 className="animate-spin" aria-hidden /> {t('Remaking pack')}</> : <><RotateCcw aria-hidden /> {t('Remake pack')}</>}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('Remake this pack?')}>
        <div className="grid gap-4">
          <p className="text-ink-muted">
            {t("The whole pack is made again the normal way, including the polish step, and gets a new quality score. When it is ready it replaces the current one (a copy of the old one is kept in the pack's old folder). If it fails, nothing changes. It takes a few minutes and uses your AI allowance.")}
          </p>
          <label className="grid gap-1.5">
            <span className="text-small font-semibold">{t('What should be better?')} <span className="font-normal text-ink-muted">{t('(optional)')}</span></span>
            <textarea className={`${inputClass} min-h-24 resize-y`} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={t('For example: a shorter letter, put the process work first')} maxLength={1000} />
          </label>
          <div className="flex gap-3">
            <Button onClick={remake}>{t('Remake pack')}</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
          </div>
        </div>
      </Dialog>
      {busy && <p className="basis-full text-small text-ink-muted">{t('Making the new pack. This takes a few minutes; your current pack stays until the new one is ready.')}</p>}
    </>
  )
}

/** The job's learning guide: shown when there is one, made only when you press the button */
export function LearningGuide({ job }: { job: Job }) {
  const [guide, setGuide] = useState<Guide | null>(null)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const api = useData()
  useEffect(() => {
    api.guide(job.n).then(setGuide, () => setGuide(null))
  }, [job.n, api])

  if (!job.to_learn.trim()) return null

  async function make() {
    setAsking(false)
    setBusy(true)
    const result = await api.makeGuide(job.n)
    setBusy(false)
    toast(result.message, result.ok)
    if (result.ok) setGuide(await api.guide(job.n))
  }

  return (
    <section aria-labelledby="guide" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="guide" className="flex items-center gap-2 text-title font-semibold">
          <BookOpen className="size-5 text-score-good" aria-hidden /> {t('Learning guide')}
        </h3>
        <Button variant={guide ? 'ghost' : 'secondary'} size="sm" disabled={busy} onClick={() => setAsking(true)}>
          {busy ? <><Loader2 className="animate-spin" aria-hidden /> {t('Making the guide')}</>
            : guide ? <><RotateCcw aria-hidden /> {t('Remake guide')}</> : t('Make a learning guide')}
        </Button>
      </div>
      {!guide && !busy && (
        <p className="text-small text-ink-muted">
          {t('A short plan for the To learn points of this job: what each one is, free courses and videos, the time it takes, and a one-week plan to be ready for the interview.')}
        </p>
      )}
      {guide && <GuideView guide={guide} />}
      <Dialog open={asking} onClose={() => setAsking(false)} title={guide ? t('Make the guide again?') : t('Make a learning guide?')}>
        <p className="text-ink-muted">
          {t('The AI writes a guide for these points, using your AI allowance. It takes up to a minute.')}
        </p>
        <ul className="mt-3 grid gap-1 text-small">
          {tList(job.to_learn).split(';').map((s) => s.trim()).filter(Boolean).map((s) => <li key={s}>{s}</li>)}
        </ul>
        <div className="mt-6 flex gap-3">
          <Button onClick={make}>{guide ? t('Remake guide') : t('Make the guide')}</Button>
          <Button variant="secondary" onClick={() => setAsking(false)}>{t('Cancel')}</Button>
        </div>
      </Dialog>
    </section>
  )
}

function GuideView({ guide }: { guide: Guide }) {
  return (
    <div className="grid gap-4">
      {guide.items.map((item) => (
        <article key={item.skill} className="rounded-lg bg-charcoal-850 p-5 shadow-depth-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h4 className="font-semibold">{item.skill}</h4>
            <span className="text-small text-ink-muted">{item.hours}</span>
          </div>
          <p className="mt-2 text-small text-ink-muted">{item.what_it_is}</p>
          <p className="mt-1.5 text-small"><span className="text-ink-muted">{t('Why this job needs it:')}</span> {item.why_this_job}</p>
          <ul className="mt-3 grid gap-2">
            {item.resources.map((r) => (
              <li key={r.url} className="text-small">
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-score-good underline-offset-4 hover:underline">
                  {r.platform.replace(' (official site, docs or free trial)', '')}: {r.search} <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <span className="text-ink-muted"> ({r.cost}) {r.what_you_get}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
      <details className="rounded-lg bg-charcoal-850 p-5 shadow-depth-1">
        <summary className="cursor-pointer font-semibold">{t('One-week plan')}</summary>
        <ol className="mt-3 grid gap-2 text-small">
          {guide.week.map((d) => (
            <li key={d.day} className="grid grid-cols-[4rem_1fr] gap-3"><span className="text-ink-muted">{d.day}</span><span>{d.plan}</span></li>
          ))}
        </ol>
      </details>
      <p className="text-small"><span className="text-ink-muted">{t('In the interview:')}</span> {guide.interview_tip}</p>
      <p className="text-[0.75rem] text-ink-muted">
        {t('Made on')} <span className="font-mono tabular">{guide.made_on}</span> {t('by {who}. The links are searches on each site, so they always open.', { who: t(guide.made_by) })}
      </p>
    </div>
  )
}
