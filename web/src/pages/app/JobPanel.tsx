import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, FileText, Loader2, MessagesSquare, PenLine, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ScoreBreakdown } from '@/components/job/ScoreBreakdown'
import { ScoreRing } from '@/components/job/ScoreRing'
import { StatusPill, TagList } from '@/components/job/Tag'
import { useToast } from '@/components/app/toast-context'
import { Button } from '@/components/ui/button'
import { useData, useJobs } from '@/lib/dataSource'
import type { ActionResult, Job } from '@/lib/types'
import { LearningGuide, PackQuality, RemakePack } from './PackExtras'
import { inputClass } from './TopBarDialogs'
import { t } from '@/i18n'
import { localDescription } from '@/i18n/jobText'

const APPLIED = ['applied', 'interview', 'offer']

/** The side panel of one job: score and why, the job ad, and every button.
 *  `number` null = closed. It loads the job again after each button, so it is always up to date. */
export function JobPanel({ number, onClose }: { number: number | null; onClose: () => void }) {
  useEffect(() => {
    if (number === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [number, onClose])

  return (
    <AnimatePresence>
      {number !== null && (
        <>
          <motion.div
            key="shade"
            className="fixed inset-0 z-40 bg-charcoal-950/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="panel"
            aria-label={t('Job details')}
            className="fixed top-0 right-0 bottom-0 z-50 w-[min(40rem,100vw)] overflow-y-auto border-l border-hairline bg-charcoal-900 shadow-depth-3"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <PanelContent key={number} number={number} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function PanelContent({ number, onClose }: { number: number; onClose: () => void }) {
  const api = useData()
  const { reload } = useJobs()
  const toast = useToast()
  const [job, setJob] = useState<Job | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null) // which button is working
  const [replacing, setReplacing] = useState(false) // pasting a new job ad over the saved one

  const load = useCallback(async () => {
    try {
      setJob(await api.job(number))
    } catch {
      setMissing(true)
    }
  }, [number, api])
  useEffect(() => {
    api.job(number).then(setJob, () => setMissing(true)) // the first load; buttons call load() again
  }, [number, api])

  /** Runs a button, shows its message, then loads the jobs and this job again */
  async function act(name: string, action: () => Promise<ActionResult>) {
    setBusy(name)
    const result = await action()
    setBusy(null)
    // a new pack may list tools the job asks for that are not on your CV
    const tools = Array.isArray(result.tool_to_learn) ? (result.tool_to_learn as string[]) : []
    toast(result.message + (result.ok && tools.length ? t('. Tools to learn (not on your CV): {tools}', { tools: tools.join(', ') }) : ''), result.ok)
    if (name === 'description') setReplacing(false)
    await Promise.all([reload(), load()])
  }

  if (missing) {
    return (
      <div className="p-8">
        <CloseButton onClose={onClose} />
        <p className="mt-10 text-ink-muted">{t('There is no job number {n}.', { n: number })}</p>
      </div>
    )
  }
  if (!job) {
    return (
      <div className="flex items-center gap-3 p-8 text-ink-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t('Loading job {n}', { n: number })}
      </div>
    )
  }

  const applied = APPLIED.includes(job.status)
  const notInterested = job.status === 'not interested'
  const hasPack = Boolean(job.files.cv || job.files.letter || job.files.prep)
  const working = busy !== null

  return (
    <div className="grid gap-8 p-8">
      {/* ---- Header: score, title, where, tags ---- */}
      <header className="grid gap-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-small text-ink-muted">
            {t('Job')} <span className="font-mono tabular">{job.n}</span>, {t('found')}{' '}
            <span className="font-mono tabular">{job.found_on}</span>
          </p>
          <CloseButton onClose={onClose} />
        </div>
        <div className="flex items-center gap-6">
          <ScoreRing score={job.score} size="lg" className="max-sm:scale-75 max-sm:-m-4" />
          <div className="min-w-0">
            <h2 className="font-wide text-title font-semibold sm:text-[1.5rem] sm:leading-tight">{job.title}</h2>
            <p className="mt-1.5 flex flex-wrap gap-x-4 text-ink-muted">
              <span className="text-ink">{job.company}</span>
              <span>{job.location || t('Location not stated')}</span>
              <span>{t('via {source}', { source: t(job.source) })}</span>
            </p>
            {job.status !== 'new' && <div className="mt-3"><StatusPill status={job.status} /></div>}
          </div>
        </div>
        <TagList tags={job.tags} />
      </header>

      {/* ---- Buttons: the main one depends on where the job is ---- */}
      <section aria-label={t('Actions')} className="flex flex-wrap gap-3">
        {hasPack ? (
          <>
            <PackLinks job={job} />
            <RemakePack job={job} onDone={load} />
          </>
        ) : job.short ? null : (
          <Button size="lg" disabled={working} onClick={() => act('pack', () => api.makePack(job.n))}>
            {busy === 'pack' ? <><Loader2 className="animate-spin" aria-hidden /> {t('Making application pack')}</> : t('Make application pack')}
          </Button>
        )}
        {applied ? (
          <Button variant="secondary" size="lg" disabled={working} onClick={() => act('applied', () => api.undoApplied(job.n))}>
            {t('Undo applied')}
          </Button>
        ) : (
          <Button variant="secondary" size="lg" disabled={working} onClick={() => act('applied', () => api.markApplied(job.n))}>
            {t('Mark as applied')}
          </Button>
        )}
        {notInterested ? (
          <Button variant="ghost" size="lg" disabled={working} onClick={() => act('notint', () => api.undoNotInterested(job.n))}>
            {t('Undo not interested')}
          </Button>
        ) : !applied && (
          <Button variant="ghost" size="lg" disabled={working} onClick={() => act('notint', () => api.notInterested(job.n))}>
            {t('Not interested')}
          </Button>
        )}
        {job.url && (
          <Button variant="ghost" size="lg" asChild>
            <a href={job.url} target="_blank" rel="noreferrer">{t('Open job ad')} <ExternalLink aria-hidden /></a>
          </Button>
        )}
      </section>
      {hasPack && <div className="-mt-4"><PackQuality job={job} /></div>}
      {busy === 'pack' && (
        <p className="-mt-4 text-small text-ink-muted">
          {t('The AI is writing your CV, letter and interview prep. This takes a few minutes; you can keep this panel open.')}
        </p>
      )}

      {/* ---- Missing description: paste it, then it is scored ---- */}
      {(job.short || replacing) && (
        <AddDescription job={job} busy={working} replacing={!job.short}
          onSave={(text) => act('description', () => api.addDescription(job.n, text))} />
      )}

      {/* ---- Why this score ---- */}
      {job.score > 0 && (
        <section aria-labelledby="why" className="grid gap-4">
          <h3 id="why" className="text-title font-semibold">{t('Why this score')}</h3>
          {job.summary && <p className="max-w-[68ch] text-ink-muted">{t(job.summary)}</p>}
          <p className="text-small text-ink-muted">
            {t('AI fit')} <span className="font-mono text-ink tabular">{job.fit || '–'}</span>
            {job.adjustments && <>, {t('then the rules:')} <span className="text-ink">{t(job.adjustments)}</span></>}
          </p>
          <ScoreBreakdown job={job} />
        </section>
      )}

      {/* ---- To learn: a learning guide, made only when asked ---- */}
      <LearningGuide job={job} />

      {/* ---- Facts ---- */}
      <section aria-labelledby="facts">
        <h3 id="facts" className="text-title font-semibold">{t('Details')}</h3>
        <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2.5 text-small">
          <Fact label={t('Trust')}>{[t(job.trust), job.trust_reason].filter(Boolean).join(': ')}</Fact>
          <Fact label={t('Languages')}>{[job.language, job.languages_preferred && t('a plus: {langs}', { langs: job.languages_preferred })].filter(Boolean).join(', ')}</Fact>
          <Fact label={t('Contact')}>{job.contact}</Fact>
          <Fact label={t('Tools to learn')}>{job.tool_to_learn}</Fact>
          <Fact label={t('Applied on')}>{job.applied_on}</Fact>
          <Fact label={t('Scored')}>{[job.model, job.scored_on].filter(Boolean).join(', ')}</Fact>
          <Fact label={t('Pack')}>{[job.pack_model && t(job.pack_model), job.quality && t('quality {q}/10', { q: job.quality })].filter(Boolean).join(', ')}</Fact>
        </dl>
      </section>

      {/* ---- The job ad itself ---- */}
      {job.description && (
        <details className="group rounded-lg bg-charcoal-850 p-5 shadow-depth-1">
          <summary className="cursor-pointer text-title font-semibold marker:text-ink-faint">{t('The job ad')}</summary>
          {!job.short && !replacing && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setReplacing(true)}>{t('Paste a newer job ad')}</Button>
          )}
          <p className="mt-4 max-w-[68ch] whitespace-pre-line text-ink-muted">{localDescription(job)}</p>
        </details>
      )}
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('Close the panel')} className="shrink-0">
      <X />
    </Button>
  )
}

/** One line of the Details list; left out when there is nothing to say */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

const DOCS = [
  { key: 'cv', label: 'CV', icon: FileText },
  { key: 'letter', label: 'Cover letter', icon: PenLine },
  { key: 'prep', label: 'Interview prep', icon: MessagesSquare },
] as const

/** The pack's files, opened in a new tab (PDFs and the prep sheet, served by serve.py) */
function PackLinks({ job }: { job: Job }) {
  const { fileUrl } = useData()
  return (
    <>
      {DOCS.filter(({ key }) => job.files[key]).map(({ key, label, icon: Icon }, i) => (
        <Button key={key} size="lg" variant={i === 0 ? 'default' : 'secondary'} asChild>
          <a href={fileUrl(job.files[key]!)} target="_blank" rel="noreferrer"><Icon aria-hidden /> {t(label)}</a>
        </Button>
      ))}
    </>
  )
}

function AddDescription({ job, busy, onSave, replacing = false }: { job: Job; busy: boolean; onSave: (text: string) => void; replacing?: boolean }) {
  const [text, setText] = useState('')
  const length = text.trim().length
  const enough = length >= 300
  return (
    <section aria-labelledby="add-description" className="grid gap-3 rounded-lg bg-charcoal-850 p-5 shadow-depth-1">
      <h3 id="add-description" className="text-title font-semibold">{replacing ? t('Paste a newer job ad') : t('The job ad is missing or cut off')}</h3>
      <p className="text-small text-ink-muted">
        {t('Paste the full text from the job page, then it is scored. The application pack needs it too.')}
        {job.url && <> <a href={job.url} target="_blank" rel="noreferrer" className="text-score-good underline-offset-4 hover:underline">{t('Open the job page')}</a>.</>}
      </p>
      <textarea className={`${inputClass} min-h-36 resize-y`} value={text} onChange={(e) => setText(e.target.value)}
        aria-label={t('Job description')} placeholder={t('Paste the whole job ad here')} />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!enough || busy} onClick={() => onSave(text)}>{t('Save and score')}</Button>
        <span className={enough ? 'text-small text-go-400' : 'text-small text-ink-muted'}>
          <span className="font-mono tabular">{length}</span> {t('of at least')} <span className="font-mono tabular">300</span> {t('characters')}
        </span>
      </div>
    </section>
  )
}
