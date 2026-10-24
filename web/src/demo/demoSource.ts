// The /demo data source: the same buttons as the real app, but everything happens in this browser
// with invented data (sampleData.ts). Nothing is ever sent anywhere: no serve.py, no AI.
// AI buttons (Make pack, Remake, Learning guide, Run search) wait a few seconds, like the real
// thing, then show ready-made sample results. Changes are kept in localStorage until "Reset demo".
import type { DataSource, NewJob, Profile, ProfileValue } from '@/lib/dataSource'
import type { ActionResult, Job, JobTab, LearningGuide, PageData } from '@/lib/types'
import { getLang, locale, t, tList, type Lang } from '@/i18n'
import { DEMO_TODAY, demoJobs, demoSearchFinds, packKeyFor, sampleProfileFor, samplePacks, samplePacksFor } from './sampleData'

const KEY = 'job2go-demo-v4' // a new number when the sample data changes, so old saved demos start fresh
const APPLIED = ['applied', 'interview', 'offer']
// Dropped by the free filters (never scored, not shown in the lists), like store.SKIPPED_STATUSES
const SKIPPED = ['filtered', 'irrelevant title', 'wrong location', 'duplicate']
const FILTER_LABELS: [string, string][] = [['wrong location', 'Wrong location'], ['irrelevant title', 'Title you never want'],
  ['duplicate', 'Duplicate'], ['filtered', 'Other rules (language, seniority)']]
const SEARCH_SECONDS = 9

interface State {
  jobs: Job[]
  /** the profile as edited in each language (none = the sample profile of that language) */
  profiles: Partial<Record<Lang, Profile>>
  guides: Record<number, LearningGuide>
  searchStarted: number // when "Run search" was pressed (0 = never)
  searchDone: boolean
}

function fresh(): State {
  const jobs = demoJobs().map((j) => {
    const home = j.location.startsWith('Lisbon') ? { loc_group: 'Lisbon' } : {}
    return j.status === 'pack ready' ? { ...j, ...home, ...packFor(j, samplePacks[packKeyFor(j.title)].quality) } : { ...j, ...home }
  })
  return { jobs, profiles: {}, guides: {}, searchStarted: 0, searchDone: false }
}

let state: State = load()

function load(): State {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return JSON.parse(saved) as State
  } catch {
    // private window or blocked storage: the demo simply starts fresh
  }
  return fresh()
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // not saved, but the demo keeps working for this visit
  }
}

/** "Reset demo": back to the start */
export function resetDemo() {
  state = fresh()
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to remove
  }
}

/** The demo person's profile in the current language */
function profileNow(): Profile {
  return state.profiles[getLang()] ?? (structuredClone(sampleProfileFor(getLang())) as unknown as Profile)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const ok = (message: string, vars?: Record<string, string | number>): ActionResult => ({ ok: true, message: t(message, vars) })
const find = (n: number) => state.jobs.find((j) => j.n === n)

/** Same tab rules as report.py */
function tabOf(job: Job): JobTab {
  if (SKIPPED.includes(job.status)) return 'hidden'
  if (APPLIED.includes(job.status)) return 'applied'
  if (job.status === 'not interested') return 'notint'
  if (job.status === 'rejected') return 'rejected'
  if (job.source === 'added by you') return 'manual'
  if (job.status.startsWith('incomplete')) return 'incomplete'
  if (job.score >= 7) return 'good'
  if (job.score >= 6) return 'maybe'
  return 'hidden'
}

function change(n: number, fields: Partial<Job>): ActionResult | null {
  const job = find(n)
  if (!job) return { ok: false, message: t('There is no job #{n}.', { n }) }
  Object.assign(job, fields)
  save()
  return null
}

/** The sample pack's files: made on the fly as small web pages (see demoFile) */
function packFor(job: Job, quality: string): Partial<Job> {
  return {
    status: APPLIED.includes(job.status) ? job.status : 'pack ready',
    quality,
    pack_model: 'sample',
    pack_polished: true,
    files: { cv: `demo/${job.n}/cv`, letter: `demo/${job.n}/letter`, prep: `demo/${job.n}/prep` },
  }
}

function pageData(): PageData {
  const jobs = state.jobs.map((j) => ({ ...j, tab: tabOf(j) })).filter((j) => j.tab !== 'hidden')
  const rank = (j: Job) => (j.new ? 0 : 1) * 100 + (j.trust === 'Trusted' ? 0 : 50) + (10 - j.score)
  jobs.sort((a, b) => rank(a) - rank(b))
  const all = state.jobs
  const kept = all.filter((j) => !SKIPPED.includes(j.status))
  const sources = new Map<string, number>()
  all.forEach((j) => sources.set(j.source, (sources.get(j.source) ?? 0) + 1))
  return {
    updated: t('15 Jan 2026, 08:00'),
    new_when: 'found today',
    settings: { good_min: 7, min_score: 6, new_min: 7, min_description: 300 },
    stats: {
      tracked: all.length,
      new_today: jobs.filter((j) => j.new).length,
      good: jobs.filter((j) => j.tab === 'good').length,
      applied: jobs.filter((j) => j.tab === 'applied').length,
    },
    charts: {
      sources: [...sources.entries()].sort((a, b) => b[1] - a[1]),
      scores: Array.from({ length: 10 }, (_, i) => [i + 1, kept.filter((j) => j.score === i + 1).length] as [number, number]),
      weeks: ['24 Nov', '01 Dec', '08 Dec', '15 Dec', '22 Dec', '29 Dec', '05 Jan', '12 Jan']
        .map((w, i) => [w, [0, 1, 0, 2, 1, 1, 3, 2][i]] as [string, number]),
    },
    jobs,
    funnel: {
      days: 7,
      found: all.length,
      filtered: FILTER_LABELS.map(([status, label]) => [label, all.filter((j) => j.status === status).length] as [string, number]),
      scored: kept.filter((j) => j.score > 0).length,
      good: kept.filter((j) => j.score >= 7).length,
    },
  }
}

/** A sample learning guide for a job's To learn points; the links are searches, made here */
function guideFor(job: Job): LearningGuide {
  const items = tList(job.to_learn).split(';').map((t) => t.trim()).filter(Boolean)
  const search = (site: string, q: string) => site.replace('{q}', encodeURIComponent(q).replaceAll('%20', '+'))
  return {
    title: job.title,
    company: job.company,
    made_on: DEMO_TODAY,
    made_by: 'sample guide (demo)',
    items: items.map((skill) => ({
      skill,
      what_it_is: t('A short, practical introduction to {skill}: the main ideas and the words people use.', { skill: skill.toLowerCase() }),
      why_this_job: t('The ad mentions it, so expect a question about {skill} in the interview.', { skill: skill.toLowerCase() }),
      hours: t('3-5 hours'),
      resources: [
        { platform: 'YouTube', search: t('{skill} explained', { skill }), what_you_get: t('A quick overview video'), cost: t('Free'),
          url: search('https://www.youtube.com/results?search_query={q}', t('{skill} explained', { skill })) },
        { platform: 'Coursera', search: skill, what_you_get: t('A short course you can audit'), cost: t('Free to audit'),
          url: search('https://www.coursera.org/search?query={q}', skill) },
      ],
    })),
    week: ['Watch an overview video for each point', 'Take notes: 5 key words per point', 'Start the first course',
      'Finish the first course module', 'Practise explaining each point in two sentences', 'Link each point to your own experience',
      'Mock interview: answer three questions out loud'].map((plan, i) => ({ day: t('Day {n}', { n: i + 1 }), plan: t(plan) })),
    interview_tip: t('Say what you already did that is close, then what you are learning and how far you got. Never claim experience you do not have.'),
  }
}

export const demoSource: DataSource = {
  jobs: async () => pageData(),
  job: async (n) => {
    const job = find(n)
    if (!job) throw new Error('No such job')
    return { ...job, tab: tabOf(job) }
  },
  profile: async () => {
    const profile = profileNow()
    return { profile: structuredClone(profile), sections: Object.keys(profile) }
  },
  saveProfile: async (section: string, value: ProfileValue) => {
    state.profiles[getLang()] = { ...profileNow(), [section]: value }
    files.clear() // the CVs and letters show the new profile
    save()
    return ok('Saved in this demo only (your browser). The real app makes a backup of profile.yaml first.')
  },
  usage: async () => ({
    claude_on: true, claude_used: 12, claude_cap: 150,
    gemini: [{ role: 'Scoring', model: 'gemini (sample)', out: false }, { role: 'Packs', model: 'gemini (sample)', out: false }],
  }),
  runStatus: async () => {
    const seconds = state.searchStarted ? (Date.now() - state.searchStarted) / 1000 : 0
    const running = state.searchStarted > 0 && seconds < SEARCH_SECONDS
    if (state.searchStarted && !running && !state.searchDone) {
      state.jobs.push(...demoSearchFinds())
      state.searchDone = true
      save()
    }
    const steps = ['Searching 7 job sites', 'Filtering out the noise', 'Scoring new jobs with AI', 'Saving']
    return {
      running, code: running ? null : 0, elapsed: `0 min ${String(Math.floor(seconds)).padStart(2, '0')} s`,
      lines: running ? [steps[Math.min(steps.length - 1, Math.floor((seconds / SEARCH_SECONDS) * steps.length))]] : ['Done'],
    }
  },
  markApplied: async (n) => change(n, { status: 'applied', applied_on: DEMO_TODAY }) ?? ok('Marked as applied.'),
  undoApplied: async (n) => change(n, { status: find(n)?.files.cv ? 'pack ready' : 'new', applied_on: '' }) ?? ok('Undone.'),
  notInterested: async (n) => change(n, { status: 'not interested' }) ?? ok('Job #{n} moved to “Not interested”.', { n }),
  undoNotInterested: async (n) => change(n, { status: find(n)?.files.cv ? 'pack ready' : 'new' }) ?? ok('Undone.'),
  setStatus: async (n, status) =>
    change(n, { status, ...(APPLIED.includes(status) && !find(n)?.applied_on ? { applied_on: DEMO_TODAY } : {}) }) ??
    ok('Job #{n} moved to “{status}”.', { n, status: t(status.charAt(0).toUpperCase() + status.slice(1)) }),
  addDescription: async (n, description) => {
    await wait(1500)
    return change(n, { description, short: false, status: 'new', score: 7 }) ?? ok('Description saved and job #{n} scored (sample score).', { n })
  },
  addJob: async (job: NewJob) => {
    await wait(1800)
    const n = Math.max(...state.jobs.map((j) => j.n)) + 1
    const base = state.jobs[0]
    state.jobs.push({
      ...base, n, new: false, title: job.title, company: job.company, location: job.location || t('Not stated'),
      source: 'added by you', url: job.link, status: 'new', found_on: DEMO_TODAY, applied_on: '', score: 7, fit: '7',
      adjustments: '', files: {}, quality: '', description: job.description, short: false,
      summary: 'A job you added yourself. In the demo it gets a sample score of 7.',
    })
    save()
    return ok('Saved and scored as job #{n} (sample score).', { n })
  },
  makePack: async (n) => {
    await wait(4000)
    const job = find(n)
    return (job && change(n, packFor(job, samplePacks[packKeyFor(job.title)].quality))) ?? ok('Pack ready (sample documents).')
  },
  remakePack: async (n) => {
    await wait(4000)
    const job = find(n)
    return (job && change(n, packFor(job, '8.6'))) ?? ok('New pack ready, quality 8.6/10 (sample).')
  },
  makeGuide: async (n) => {
    await wait(2500)
    const job = find(n)
    if (!job) return { ok: false, message: t('There is no job #{n}.', { n }) }
    state.guides[n] = guideFor(job)
    save()
    return ok('Learning guide ready (sample).')
  },
  guide: async (n) => {
    if (!state.guides[n]) throw new Error('No guide yet')
    return state.guides[n]
  },
  runSearch: async () => {
    if (state.searchDone) return { ok: false, message: t('The demo search already ran. Press Reset demo to try it again.') }
    state.searchStarted = Date.now()
    save()
    return ok('Search started (demo).')
  },
  fileUrl: (path) => demoFile(path),
}

// ---------- the sample pack documents, as small web pages ----------

const files = new Map<string, string>()

/** "demo/<n>/cv" -> a blob: address of a small page with the sample CV, letter or prep sheet */
function demoFile(path: string): string {
  const key = `${getLang()}:${path}`
  const cached = files.get(key)
  if (cached) return cached
  const [, n, kind] = path.split('/')
  const job = find(Number(n))
  const html = paper(kind === 'cv' ? cvHtml(job) : kind === 'letter' ? letterHtml(job) : prepHtml(job), kind !== 'prep')
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  files.set(key, url)
  return url
}

const esc = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
function paper(body: string, serif = true): string {
  return `<!doctype html><meta charset="utf-8"><html lang="${getLang()}"><title>${t('Sample document')}</title><style>
body{margin:0;background:#3a3c42;color:#1d1d1b;font:${serif ? '12.5px/1.42 Georgia,"Times New Roman",serif' : '14px/1.55 Arial,sans-serif'}}
main{width:210mm;min-height:297mm;box-sizing:border-box;margin:24px auto;background:#fff;padding:14mm 16mm;box-shadow:0 10px 40px rgba(0,0,0,.4)}
h1{font-size:22px;text-align:center;margin:0}.center{text-align:center;margin:2px 0}.small{font-size:11px;color:#444}
h2{font-size:12px;letter-spacing:.04em;border-bottom:1.2px solid #1d1d1b;margin:11px 0 4px;padding-bottom:1px;text-transform:uppercase}
h3{font-size:15px;margin:18px 0 6px}.row{display:flex;justify-content:space-between;gap:12px;margin-top:5px}
ul{margin:2px 0 0 16px;padding:0}li{margin:1px 0}p{margin:4px 0}.demo{font:11px Arial,sans-serif;color:#8a2c22;text-align:center;margin:-6mm 0 4mm}
.q{font-weight:bold;margin-top:10px}</style><main><p class="demo">${t('Sample document from the Job2go demo. The person and the job are invented.')}</p>${body}</main>`
}

type Exp = { role: string; company: string; location: string; dates: string; highlights: string[] }
type Project = { name: string; type: string; dates: string; highlights: string[] }
const fill = (text: string, job?: Job) => text.replaceAll('{title}', job?.title ?? t('this')).replaceAll('{company}', job?.company ?? t('your company'))
const packOf = (job?: Job) => samplePacksFor(getLang())[packKeyFor(job?.title ?? '')]

/** One-page CV, laid out like the real packs, tailored by the sample pack */
function cvHtml(job?: Job): string {
  const p = profileNow()
  const pack = packOf(job)
  const c = (p.contact ?? {}) as Record<string, string>
  const exp = (p.experience as Exp[]) ?? []
  const projects = (p.projects as Project[]) ?? []
  const skills = (p.skills ?? {}) as Record<string, string[]>
  const label = (k: string) => t(k.charAt(0).toUpperCase() + k.slice(1).replaceAll('_', ' '))
  const jobs = exp.map((e, i) => ({ e, picks: pack.bullets[i] ?? [] })).filter(({ picks }) => picks.length)
  return `<h1>${esc(String(p.name))}</h1>
<p class="center">${esc(pack.headline)}</p>
<p class="center small">${esc([p.location, c.phone, c.email, c.linkedin, c.portfolio].filter(Boolean).join('  |  '))}</p>
<h2>${t('Summary')}</h2><p>${esc(fill(pack.summary, job))}</p>
<h2>${t('Experience')}</h2>
${jobs.map(({ e, picks }) => `<div class="row"><span><b>${esc(e.role)}</b>, <i>${esc(e.company)}, ${esc(e.location)}</i></span><span>${esc(e.dates)}</span></div>
<ul>${picks.map((i) => `<li>${esc(e.highlights[i] ?? '')}</li>`).join('')}</ul>`).join('')}
${pack.projects.length ? `<h2>${t('Projects')}</h2>${pack.projects.map((i) => projects[i]).filter(Boolean).map((pr) => `<div class="row"><span><b>${esc(pr.name)}</b>, <i>${esc(pr.type)}</i></span><span>${esc(pr.dates)}</span></div>
<ul>${pr.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`).join('')}` : ''}
<h2>${t('Education')}</h2>${((p.education as { degree: string; school: string; year: number }[]) ?? []).map((ed) =>
  `<div class="row"><span><b>${esc(ed.degree)}</b>, <i>${esc(ed.school)}</i></span><span>${ed.year}</span></div>`).join('')}
<h2>${t('Skills')}</h2><p><b>${t('Tools')}:</b> ${esc(pack.tools.join(', '))}</p>
${pack.skills.map((k) => `<p><b>${esc(label(k))}:</b> ${esc((skills[k] ?? []).join(', '))}</p>`).join('')}
<h2>${t('Languages')}</h2><p>${esc(((p.languages as string[]) ?? []).join(', '))}</p>`
}

/** The cover letter: about 250-300 words, tailored by the sample pack */
function letterHtml(job?: Job): string {
  const p = profileNow()
  const c = (p.contact ?? {}) as Record<string, string>
  return `<p><b>${esc(String(p.name))}</b><br>${esc(String(p.location))}<br>${esc(c.email ?? '')}  |  ${esc(c.phone ?? '')}</p>
<p style="margin-top:14px">${esc(new Date('2026-01-15T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
<p style="margin-top:14px">${esc(t('Hiring team, {company}', { company: job?.company ?? '' }))}<br>${esc(t('Re: {title}', { title: job?.title ?? '' }))}</p>
<p style="margin-top:14px">${esc(t('Dear hiring team,'))}</p>
${packOf(job).letter.map((para) => `<p style="margin-top:10px">${esc(fill(para, job))}</p>`).join('')}
<p style="margin-top:18px">${esc(t('Kind regards,'))}<br><br>${esc(String(p.name))}</p>`
}

/** The prep sheet: the role in plain words, likely questions with suggested answers */
function prepHtml(job?: Job): string {
  const prep = packOf(job).prep
  return `<h1>${t('Interview prep')}</h1><p class="center">${esc(t('{title} at {company}', { title: job?.title ?? '', company: job?.company ?? '' }))}</p>
<h3>${t('The role in plain words')}</h3><p>${esc(prep.plain)}</p>
<h3>${t('Questions to expect, and what to answer')}</h3>
${prep.questions.map(([q, a]) => `<p class="q">${esc(fill(q, job))}</p><p>${esc(fill(a, job))}</p>`).join('')}
<h3>${t('Questions to ask them')}</h3><ul>${prep.ask.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
<h3>${t('Be careful about')}</h3><ul>${prep.watch.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
<h3>${t('Your strongest evidence for this job')}</h3><ul>${tList(job?.strengths ?? '').split(';').filter((s) => s.trim()).map((s) => `<li>${esc(s.trim().charAt(0).toUpperCase() + s.trim().slice(1))}</li>`).join('')}</ul>`
}
