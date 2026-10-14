import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Dialog } from '@/components/app/Dialog'
import { useToast } from '@/components/app/toast-context'
import { Button } from '@/components/ui/button'
import { useBase, useData, useJobs } from '@/lib/dataSource'

const MIN_DESCRIPTION = 300 // the same as store.MIN_DESCRIPTION in Python

export const inputClass =
  'w-full rounded-sm bg-charcoal-800 px-3 py-2 text-ink shadow-depth-1 outline-none placeholder:text-ink-faint focus:shadow-glow-go'

/** "Add job": a job you found yourself. serve.py saves it and scores it right away (uses AI). */
export function AddJobDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const empty = { title: '', company: '', location: '', link: '', description: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const { reload } = useJobs()
  const api = useData()
  const base = useBase()
  const navigate = useNavigate()
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value })
  const short = form.description.trim().length < MIN_DESCRIPTION
  const ready = form.title.trim() && form.company.trim() && !short

  async function save() {
    setSaving(true)
    const result = await api.addJob(form)
    setSaving(false)
    toast(result.message, result.ok)
    if (!result.ok) return
    setForm(empty)
    onClose()
    await reload()
    const number = /#(\d+)/.exec(result.message)?.[1]
    navigate(number ? `${base}/jobs/${number}?tab=manual` : `${base}/jobs?tab=manual`)
  }

  return (
    <Dialog open={open} onClose={saving ? () => {} : onClose} title="Add a job">
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ready) void save() }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title"><input className={inputClass} value={form.title} onChange={set('title')} required /></Field>
          <Field label="Company"><input className={inputClass} value={form.company} onChange={set('company')} required /></Field>
          <Field label="Location"><input className={inputClass} value={form.location} onChange={set('location')} placeholder="Valencia, Remote ..." /></Field>
          <Field label="Link (optional)"><input className={inputClass} value={form.link} onChange={set('link')} placeholder="https://" /></Field>
        </div>
        <Field label="Job description" hint={
          <span className={short ? 'text-ink-muted' : 'text-go-400'}>
            <span className="font-mono tabular">{form.description.trim().length}</span> of at least{' '}
            <span className="font-mono tabular">{MIN_DESCRIPTION}</span> characters
          </span>
        }>
          <textarea className={`${inputClass} min-h-40 resize-y`} value={form.description} onChange={set('description')}
            placeholder="Paste the whole job ad here" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!ready || saving}>
            {saving ? <><Loader2 className="animate-spin" aria-hidden /> Saving and scoring</> : 'Save and score'}
          </Button>
          <p className="text-small text-ink-muted">Scoring uses your AI quota and takes a few seconds.</p>
        </div>
      </form>
    </Dialog>
  )
}

/** "Run search": asks first, because it reads job sites for a while and uses AI quota */
export function RunSearchDialog({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Search for new jobs now?">
      <p className="text-ink-muted">
        Job2go reads all your job sites, filters the results and scores the new ones. It takes a few minutes and
        uses your AI quota. You can keep reading meanwhile, but the buttons that change a job wait until it is done.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={onStart}>Start search</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </Dialog>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex justify-between gap-4 text-small font-semibold">
        {label}
        {hint && <span className="font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
