import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Dialog } from '@/components/app/Dialog'
import { useToast } from '@/components/app/toast-context'
import { Button } from '@/components/ui/button'
import { useData, type Profile, type ProfileValue } from '@/lib/dataSource'
import { inputClass } from './TopBarDialogs'
import { t } from '@/i18n'

// The cards of the page, in order. Each card saves its own sections of profile.yaml.
const CARDS: { id: string; title: string; help: string; sections: string[] }[] = [
  { id: 'about', title: 'About you', help: 'The top of every CV. Contact details are used exactly as written.',
    sections: ['name', 'location', 'headline', 'contact', 'summary'] },
  { id: 'languages', title: 'Languages', help: 'With your level, e.g. French (C1).', sections: ['languages'] },
  { id: 'experience', title: 'Experience', help: 'Newest first. "Other wordings" are approved ways to say the same facts; the AI picks the one that fits each job.', sections: ['experience'] },
  { id: 'projects', title: 'Projects', help: 'Your own projects and case studies.', sections: ['projects'] },
  { id: 'education', title: 'Education', help: '', sections: ['education'] },
  { id: 'skills', title: 'Skills', help: 'One row per group. Each CV shows the rows that fit the job.', sections: ['skills'] },
  { id: 'tools', title: 'Tools you know', help: 'Never printed in full: each CV shows only the tools the job asks for, plus Excel, Power BI and Claude.', sections: ['tools_inventory'] },
  { id: 'wants', title: 'Job preferences', help: 'The AI reads these when it scores a job.', sections: ['what_i_want', 'deal_breakers'] },
]
// Friendlier names for keys from profile.yaml
const LABELS: Record<string, string> = {
  what_i_want: 'What you are looking for', deal_breakers: 'Deal breakers', angles: 'Other wordings (approved)',
  taught_in: 'Taught in', focus_areas: 'Focus areas', thesis_grade: 'Thesis grade', dissertation_mark: 'Dissertation mark',
  product_and_business: 'Product and business', data_and_analytics: 'Data and analytics', ai_and_automation: 'AI and automation',
}
const label = (key: string) => t(LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replaceAll('_', ' '))
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** /app/profile: your master profile (profile.yaml), as forms. The app only saves what you type. */
export function ProfilePage() {
  const api = useData()
  const [saved, setSaved] = useState<Profile | null>(null) // what profile.yaml has now
  const [draft, setDraft] = useState<Profile | null>(null) // what you are typing
  const [failed, setFailed] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  useEffect(() => {
    api.profile().then(({ profile }) => { setSaved(profile); setDraft(profile) }, () => setFailed(true))
  }, [api])

  // Every changed line (e.g. "Experience 1, Highlights 2"), with before and after
  const changes = saved && draft ? diff(saved, draft) : []
  const dirty = changes.length > 0
  useLeaveWarning(dirty)

  if (failed) return <p className="px-8 py-24 text-ink-muted">{t('Could not load profile.yaml. Is serve.py running?')}</p>
  if (!saved || !draft) return null
  const set = (section: string, value: ProfileValue) => setDraft({ ...draft, [section]: value })

  /** Confirm: save every changed section (serve.py makes a backup first), then reload from the file */
  async function confirm() {
    setSaving(true)
    const sections = Object.keys(draft!).filter((k) => !same(draft![k], saved![k]))
    let ok = true
    for (const section of sections) {
      const result = await api.saveProfile(section, draft![section])
      if (!result.ok) {
        toast(`${label(section)}: ${result.message}`, false)
        ok = false
        break
      }
    }
    const fresh = (await api.profile()).profile
    setSaved(fresh)
    if (ok) {
      setDraft(fresh) // e.g. "2026" comes back as a number, so the form matches the file
      toast(sections.length === 1 ? t('Saved 1 section. A backup of the old profile.yaml is in backup/profile/.') : t('Saved {n} sections. A backup of the old profile.yaml is in backup/profile/.', { n: sections.length }))
      setReviewing(false)
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-6 pb-28 sm:px-8 sm:pt-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0">
        <h1 className="font-wide text-display-m font-semibold">{t('My profile')}</h1>
        <p className="mt-1 max-w-[68ch] text-ink-muted">
          {t('Everything the AI knows about you: it scores jobs against it and writes your CVs only from it, so keep it true. Nothing is saved until you review and confirm your changes; a backup of profile.yaml is made first.')}
        </p>
        <nav aria-label={t('Profile sections')} className="mt-6 flex flex-wrap gap-1">
          {CARDS.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="rounded-sm px-2.5 py-1 text-small text-ink-muted transition-colors hover:bg-charcoal-800 hover:text-ink">
              {t(c.title)}
            </a>
          ))}
        </nav>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
          {CARDS.map((card) => (
            <SectionCard key={card.id} card={card} saved={saved} draft={draft} onChange={set} />
          ))}
        </div>
      </div>
      <CvPreview profile={draft} />

      {/* The bar at the bottom: appears when something changed */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg py-2.5 pr-2.5 pl-5"
            role="status"
          >
            <span className="text-small">
              <span className="font-mono tabular">{changes.length}</span> {changes.length === 1 ? t('unsaved change') : t('unsaved changes')}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDraft(saved)}>{t('Discard')}</Button>
            <Button size="sm" onClick={() => setReviewing(true)}>{t('Review and confirm')}</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={reviewing} onClose={() => !saving && setReviewing(false)} title={t('Review your changes')}>
        <ul className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1">
          {changes.map((c) => (
            <li key={c.path} className="rounded-md bg-charcoal-900/60 p-3 text-small shadow-depth-1">
              <p className="font-semibold">{c.path}</p>
              {c.before !== null && <p className="mt-1.5 text-ink-muted"><span className="text-score-low">{t('Before:')}</span> {c.before || t('(empty)')}</p>}
              {c.after !== null && <p className="mt-1 text-ink"><span className="text-go-400">{t('After:')}</span> {c.after || t('(empty)')}</p>}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={confirm} disabled={saving}>
            {saving ? <><Loader2 className="animate-spin" aria-hidden /> {t('Saving')}</> : t('Confirm and save')}
          </Button>
          <Button variant="secondary" onClick={() => setReviewing(false)} disabled={saving}>{t('Keep editing')}</Button>
          <Button variant="ghost" onClick={() => { setDraft(saved); setReviewing(false) }} disabled={saving}>{t('Discard all')}</Button>
        </div>
      </Dialog>
    </div>
  )
}

/** Before leaving with unsaved changes: the browser asks (closing the tab), and so does the app
 *  (clicking a link in the sidebar or elsewhere) */
function useLeaveWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a')
      if (!link || link.getAttribute('href')?.startsWith('#') || link.target === '_blank') return
      if (!window.confirm(t('You have unsaved changes in My profile. Leave without saving?'))) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true) // capture: before the app's own link handling
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])
}

/** Every value as "Section, Entry 1, Field" -> text, so two versions can be compared line by line */
function flatten(value: ProfileValue, path: string, out: Map<string, string>) {
  if (Array.isArray(value) && value.some((v) => typeof v === 'object')) {
    value.forEach((v, i) => flatten(v, `${path}, ${t('entry {n}', { n: i + 1 })}`, out))
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => out.set(`${path}, ${t('item {n}', { n: i + 1 })}`, String(v)))
  } else if (typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => flatten(v, `${path}, ${label(k)}`, out))
  } else {
    out.set(path, String(value).trim())
  }
}

function diff(before: Profile, after: Profile) {
  const a = new Map<string, string>()
  const b = new Map<string, string>()
  for (const card of CARDS) {
    for (const k of card.sections) {
      if (k in before) flatten(before[k], label(k), a)
      if (k in after) flatten(after[k], label(k), b)
    }
  }
  const paths = [...new Set([...a.keys(), ...b.keys()])]
  return paths
    .filter((p) => a.get(p) !== b.get(p))
    .map((p) => ({ path: p, before: a.has(p) ? a.get(p)! : null, after: b.has(p) ? b.get(p)! : null }))
}

/** One card: its fields. Changes are saved for all cards at once, from the bar at the bottom. */
function SectionCard({ card, saved, draft, onChange }: {
  card: (typeof CARDS)[number]
  saved: Profile
  draft: Profile
  onChange: (section: string, value: ProfileValue) => void
}) {
  const changed = card.sections.some((k) => k in draft && !same(draft[k], saved[k]))
  const one = card.sections.length === 1
  return (
    <section id={card.id} aria-labelledby={`${card.id}-title`} className="scroll-mt-6 rounded-lg bg-charcoal-850 p-6 shadow-depth-2">
      <header>
        <h2 id={`${card.id}-title`} className="flex items-center gap-2.5 text-title font-semibold">
          {t(card.title)}
          {changed && <span className="rounded-full bg-go-900 px-2 py-0.5 text-[0.75rem] font-medium text-go-400">{t('Changed')}</span>}
        </h2>
        {card.help && <p className="mt-1 max-w-[60ch] text-small text-ink-muted">{t(card.help)}</p>}
      </header>
      <div className="mt-5 grid gap-5">
        {card.sections.filter((k) => k in draft).map((k) => (
          <Value key={k} name={one ? t(card.title) : label(k)} hideName={one} value={draft[k]} onChange={(v) => onChange(k, v)} />
        ))}
      </div>
    </section>
  )
}

/** Any value from profile.yaml, as the right form field (text, list, entries, groups) */
function Value({ name, value, onChange, hideName = false }: {
  name: string
  value: ProfileValue
  onChange: (value: ProfileValue) => void
  hideName?: boolean
}) {
  if (Array.isArray(value)) {
    const entries = value.some((v) => typeof v === 'object')
    return (
      <Group name={name} hideName={hideName}>
        {entries ? <Entries items={value} onChange={onChange} /> : <Words items={value as string[]} onChange={onChange} />}
      </Group>
    )
  }
  if (typeof value === 'object') {
    return (
      <Group name={name} hideName={hideName}>
        <div className="grid gap-4">
          {Object.entries(value).map(([k, v]) => (
            <Value key={k} name={label(k)} value={v} onChange={(nv) => onChange({ ...value, [k]: nv })} />
          ))}
        </div>
      </Group>
    )
  }
  const text = String(value)
  const long = text.includes('\n') || text.length > 90
  return (
    <label className="grid gap-1.5">
      {!hideName && <span className="text-small font-semibold">{name}</span>}
      {long ? (
        <textarea className={`${inputClass} resize-y leading-relaxed`} rows={Math.min(14, Math.max(2, text.split('\n').length + Math.floor(text.length / 110)))}
          value={text} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputClass} value={text} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

function Group({ name, hideName, children }: { name: string; hideName: boolean; children: ReactNode }) {
  if (hideName) return <>{children}</>
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-small font-semibold">{name}</legend>
      {children}
    </fieldset>
  )
}

/** A list of short texts (languages, skills, highlights): one field each, add / remove / move */
function Words({ items, onChange }: { items: string[]; onChange: (v: ProfileValue) => void }) {
  return (
    <div className="grid gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          {String(item).length > 70 ? (
            <textarea className={`${inputClass} min-w-0 resize-y`} rows={2} value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          ) : (
            <input className={`${inputClass} min-w-0`} value={item} aria-label={t('Item {n}', { n: i + 1 })}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          )}
          <Tools index={i} count={items.length} onMove={(to) => onChange(move(items, i, to))}
            onRemove={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange([...items, ''])}>
        <Plus aria-hidden /> {t('Add')}
      </Button>
    </div>
  )
}

/** A list of entries (each job, project, degree): a box per entry with its own fields */
function Entries({ items, onChange }: { items: ProfileValue[]; onChange: (v: ProfileValue) => void }) {
  // a new entry gets the same fields as the first one, empty
  const blank = (template: ProfileValue): ProfileValue =>
    Array.isArray(template) ? [] : typeof template === 'object'
      ? Object.fromEntries(Object.entries(template).map(([k, v]) => [k, blank(v)])) : ''
  return (
    <div className="grid gap-4">
      {items.map((item, i) => {
        const fields = item as Record<string, ProfileValue>
        const title = String(fields.role ?? fields.name ?? fields.degree ?? t('Entry {n}', { n: i + 1 }))
        return (
          <details key={i} open={i === 0} className="group rounded-md bg-charcoal-900/60 shadow-depth-1">
            <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-semibold">{title || t('New entry')}</span>
              <span className="truncate text-small text-ink-muted">{String(fields.company ?? fields.school ?? fields.type ?? '')}</span>
              <Tools index={i} count={items.length} onMove={(to) => onChange(move(items, i, to))}
                onRemove={() => onChange(items.filter((_, j) => j !== i))} />
            </summary>
            <div className="grid gap-4 border-t border-hairline p-4">
              {Object.entries(fields).map(([k, v]) => (
                <Value key={k} name={label(k)} value={v}
                  onChange={(nv) => onChange(items.map((x, j) => (j === i ? { ...fields, [k]: nv } : x)))} />
              ))}
            </div>
          </details>
        )
      })}
      <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange([...items, blank(items[0] ?? {})])}>
        <Plus aria-hidden /> {t('Add entry')}
      </Button>
    </div>
  )
}

/** Move up / down / remove, for one list item */
function Tools({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); fn() }
  return (
    <span className="flex shrink-0 gap-0.5">
      <Button variant="ghost" size="icon-sm" aria-label={t('Move up')} disabled={index === 0} onClick={stop(() => onMove(index - 1))}><ArrowUp /></Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('Move down')} disabled={index === count - 1} onClick={stop(() => onMove(index + 1))}><ArrowDown /></Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('Remove')} onClick={stop(onRemove)}><Trash2 /></Button>
    </span>
  )
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** The page hero: your CV header and summary, live as you type */
function CvPreview({ profile }: { profile: Profile }) {
  const contact = (profile.contact ?? {}) as Record<string, string>
  return (
    <aside aria-label={t('CV preview')} className="xl:sticky xl:top-8 xl:self-start">
      <p className="mb-2 text-small text-ink-muted">{t('CV preview, live')}</p>
      <div className="rounded-sm bg-[#f4f3ef] p-7 text-[#1d1d1b] shadow-depth-3">
        <p className="text-center font-wide text-[1.375rem] font-bold text-[#1f4e3a]">{String(profile.name ?? '')}</p>
        <p className="mt-1 text-center text-small">{String(profile.headline ?? '')}</p>
        <p className="mt-1 text-center text-[0.75rem] text-[#55554f]">
          {[profile.location, contact.phone, contact.email, contact.linkedin, contact.portfolio].filter(Boolean).join('  |  ')}
        </p>
        <hr className="my-4 border-[#1d1d1b]/40" />
        <p className="text-[0.75rem] font-bold text-[#1f4e3a]">{t('Profile')}</p>
        {/* the file wraps long lines by hand; on the CV they flow as one paragraph */}
        <p className="mt-1 text-[0.8125rem] leading-relaxed">{String(profile.summary ?? '').trim()}</p>
      </div>
    </aside>
  )
}
