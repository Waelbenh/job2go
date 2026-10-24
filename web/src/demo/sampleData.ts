// ============================================================================
// ALL sample data for the public showcase ("/") and the demo ("/demo").
// Everything here is INVENTED: people, companies, cities, numbers.
// It is published with the showcase, so it must never contain real jobs,
// real numbers from data/jobs.csv, or anything from profile.yaml.
// The showcase and demo read ONLY this file - never serve.py or the data/ folder
// (the code checker blocks it, see .oxlintrc.json).
// ============================================================================
import type { Lang } from '@/i18n'
import type { Job, Stats } from '@/lib/types'
import { personEn } from './person.en'
import { personEs } from './person.es'
import { personFr } from './person.fr'
import type { DemoPerson, SamplePack } from './personTypes'

// Fills in the fields a sample job doesn't need, so each entry below stays short
function job(fields: Partial<Job> & Pick<Job, 'n' | 'title' | 'company' | 'score'>): Job {
  return {
    tab: fields.score >= 7 ? 'good' : 'maybe',
    new: false,
    location: 'Remote',
    source: 'LinkedIn',
    url: '',
    status: 'new',
    found_on: '2026-01-15',
    applied_on: '',
    remote: false,
    loc_group: 'Other',
    tags: [],
    key_tags: [],
    summary: '',
    fit: String(fields.score),
    adjustments: '',
    strengths: '',
    to_learn: '',
    red_flags: '',
    unknowns: '',
    trust: 'Trusted',
    model: 'gemini (sample)',
    scored_on: '2026-01-15',
    quality: '',
    files: {},
    short: false,
    description: '',
    ...fields,
  }
}

/** The sample person's numbers */
// (the same numbers the /demo shows, so the showcase and the demo agree)
export const sampleStats: Stats = { tracked: 657, new_today: 18, good: 50, applied: 5 }

export const sampleBestMatch: Job = job({
  n: 101,
  new: true,
  score: 9,
  fit: '8',
  adjustments: '+1 (home city, entry level)',
  title: 'Product Operations Associate',
  company: 'Velora Systems',
  location: 'Lisbon, Portugal',
  key_tags: [['Trusted', 'good'], ['Lisbon', 'good'], ['Entry level', 'good']],
  summary:
    'An operations role at a mid-size software company. Your process improvement and reporting experience covers the main duties.',
  strengths: 'Three years of process improvement in operations; SQL and Power BI reporting; fluent English and Portuguese',
  to_learn: 'Their ticketing tool; release planning',
  red_flags: '',
  unknowns: 'Salary not stated',
})

export const sampleNewToday: Job[] = [
  job({
    n: 102, new: true, score: 8, title: 'Junior Data Analyst', company: 'Northwind Freight',
    location: 'Berlin, Germany', source: 'Himalayas',
    key_tags: [['Trusted', 'good'], ['Hybrid', 'neutral'], ['Visa support', 'good']],
  }),
  job({
    n: 103, new: true, score: 8, title: 'Partnerships Coordinator', company: 'Brisa Travel',
    location: 'Remote, EU', source: 'Remotive', remote: true, loc_group: 'Remote',
    key_tags: [['Trusted', 'good'], ['Remote (EU)', 'good'], ['Flexible hours', 'good']],
  }),
  job({
    n: 104, new: true, score: 7, title: 'Customer Onboarding Specialist', company: 'Halden Software',
    location: 'Amsterdam, Netherlands', source: 'Indeed', status: 'pack ready',
    key_tags: [['Trusted', 'good'], ['Hybrid', 'neutral'], ['Relocation', 'neutral']],
  }),
  job({
    n: 105, new: true, score: 6, title: 'Operations Analyst', company: 'Mercat Foods',
    location: 'Barcelona, Spain',
    key_tags: [['Check', 'neutral'], ['On-site', 'neutral'], ['Unknown', 'unknown', 'Not stated: pay, contract']],
  }),
]

/** The job that "arrives" during the hero animation */
export const sampleArriving: Job = job({
  n: 106, new: true, score: 8, title: 'Implementation Consultant', company: 'Cobalt Pay',
  location: 'Remote', source: 'We Work Remotely', remote: true, loc_group: 'Remote',
  key_tags: [['Trusted', 'good'], ['Remote', 'good'], ['Entry level', 'good']],
})

/** Jobs the free filters drop before any AI runs (the "Filters out the noise" step) */
export const sampleFilteredOut: { job: Job; reason: string }[] = [
  {
    job: job({ n: 201, score: 0, title: 'Store Manager', company: 'Fennel & Co', location: 'Lisbon, Portugal' }),
    reason: 'Title you never want',
  },
  {
    job: job({ n: 202, score: 0, title: 'Account Manager', company: 'Oriel Media', location: 'Munich, Germany' }),
    reason: 'Wrong city',
  },
  {
    job: job({ n: 203, score: 0, title: 'Support Specialist', company: 'Tarn Labs', location: 'Remote, EU' }),
    reason: 'Needs native Dutch',
  },
]

/** The board (the "You stay in control" step). The best match moves from Pack ready to Applied. */
export const sampleBoard: { column: string; jobs: Job[] }[] = [
  { column: 'New', jobs: [sampleNewToday[0], sampleNewToday[1]] },
  { column: 'Pack ready', jobs: [{ ...sampleBestMatch, new: false, status: 'pack ready' }, sampleNewToday[2]] },
  {
    column: 'Applied',
    jobs: [
      job({ n: 301, score: 8, title: 'Business Analyst', company: 'Quay Insurance', location: 'Remote, EU',
            status: 'applied', applied_on: '2026-01-12' }),
    ],
  },
  {
    column: 'Interview',
    jobs: [
      job({ n: 302, score: 9, title: 'Operations Coordinator', company: 'Larch Health', location: 'Berlin, Germany',
            status: 'interview', applied_on: '2026-01-05' }),
    ],
  },
]

// ============================================================================
// The /demo app: a whole invented job search for an invented person, Inês Valadares.
// ============================================================================

/** "Today" in the demo (the sample jobs above were found on this day) */
export const DEMO_TODAY = '2026-01-15'

/** The demo person (the "My profile" page and every sample CV), in each language. Invented from start to end:
 *  Inês Valadares, an industrial engineer in Lisbon with three years of experience. See person.en.ts. */
const PEOPLE: Record<Lang, DemoPerson> = { en: personEn, fr: personFr, es: personEs }
export const sampleProfile = personEn.profile
export const sampleProfileFor = (lang: Lang) => PEOPLE[lang].profile

// What each kind of role says about the person (the AI's "strengths / to learn / red flags")
const KINDS = {
  ops: { strengths: 'Lean process improvement in logistics; SQL and Power BI reporting; client onboarding experience', to_learn: 'Their internal ticketing tool; release planning', summary: 'An operations role where your process improvement and reporting work covers most duties.' },
  cs: { strengths: 'Client onboarding in logistics; supplier and client contact in three languages; clear written procedures', to_learn: 'Their CRM workflows; renewal and churn metrics', summary: 'A customer-facing operations role; your onboarding work and languages fit, the CRM side is new.' },
  data: { strengths: 'SQL and Power BI reporting; weekly reports for an operations lead', to_learn: 'Advanced statistics; data modelling basics', summary: 'A junior analyst role; your reporting work is a good start, some tools need practice.' },
  product: { strengths: 'Process mapping; turning client feedback into changes; small Python tools you built', to_learn: 'User story writing; product analytics tools', summary: 'A junior product role; strong on process and data, lighter on product tools.' },
  sales: { strengths: 'Supplier and client communication in three languages; quarterly reviews with key accounts', to_learn: 'Their sales CRM; pipeline forecasting', summary: 'A partnerships role that values languages and structured client work.' },
  fin: { strengths: 'Careful process work; communication in three languages', to_learn: 'Forex and CFD trading basics; KYC procedures in financial services', summary: 'A client role at a trading firm; the industry is new to you, the process work is not.' },
}
type Kind = keyof typeof KINDS

// [title, company, location, source, score, status, kind, found_on]
const DEMO_ROWS: [string, string, string, string, number, string, Kind, string][] = [
  ['Operations Coordinator', 'Harbor & Pine', 'Lisbon, Portugal', 'LinkedIn', 8, 'pack ready', 'ops', DEMO_TODAY],
  ['Customer Success Associate', 'Lumen Health', 'Remote, EU', 'Remotive', 8, 'new', 'cs', DEMO_TODAY],
  ['Business Operations Analyst', 'Kestrel Mobility', 'Porto, Portugal', 'Indeed', 7, 'new', 'data', DEMO_TODAY],
  ['Junior Product Owner', 'Orchard Apps', 'Lisbon, Portugal', 'LinkedIn', 7, 'new', 'product', DEMO_TODAY],
  ['Client Onboarding Specialist', 'Atlas Payroll', 'Remote, EU', 'Himalayas', 9, 'new', 'cs', DEMO_TODAY],
  ['Service Operations Associate', 'Bluefin Energy', 'Lisbon, Portugal', 'InfoJobs', 7, 'new', 'ops', '2026-01-14'],
  ['Partnerships Associate', 'Solace Travel', 'Madrid, Spain', 'LinkedIn', 7, 'pack ready', 'sales', '2026-01-14'],
  ['Data Operations Assistant', 'Granite Insurance', 'Remote, Portugal', 'We Work Remotely', 6, 'new', 'data', '2026-01-14'],
  ['Customer Experience Specialist', 'Nimbus Telecom', 'Lisbon, Portugal', 'Indeed', 6, 'new', 'cs', '2026-01-13'],
  ['Multilingual Account Executive', 'Corvid Markets', 'Remote, worldwide', 'Himalayas', 9, 'pack ready', 'fin', '2026-01-12'],
  ['Implementation Analyst', 'Fable Software', 'Remote, EU', 'Remote OK', 8, 'pack ready', 'ops', '2026-01-12'],
  ['Product Support Analyst', 'Verde Foods', 'Lisbon, Portugal', 'LinkedIn', 7, 'applied', 'product', '2026-01-08'],
  ['Customer Success Manager', 'Quill Learning', 'Remote, EU', 'Remotive', 8, 'interview', 'cs', '2026-01-03'],
  ['Operations Associate', 'Saltmarsh Retail', 'Lisbon, Portugal', 'Indeed', 7, 'applied', 'ops', '2026-01-06'],
  ['Revenue Operations Assistant', 'Pinnacle Media', 'Barcelona, Spain', 'LinkedIn', 6, 'rejected', 'data', '2025-12-28'],
  ['Sales Development Representative', 'Brightwave Solar', 'Lisbon, Portugal', 'LinkedIn', 5, 'not interested', 'sales', '2026-01-10'],
  ['Senior Operations Manager', 'Ironclad Group', 'Lisbon, Portugal', 'LinkedIn', 4, 'new', 'ops', '2026-01-11'],
  ['Customer Support Lead', 'Meridian Bank', 'Porto, Portugal', 'Indeed', 5, 'new', 'cs', '2026-01-11'],
  ['Junior Data Analyst', 'Copperleaf', 'Remote, EU', 'Himalayas', 7, 'pack ready', 'data', '2026-01-13'],
  ['Product Operations Specialist', 'Wren Health', 'Lisbon, Portugal', 'LinkedIn', 8, 'new', 'product', '2026-01-13'],
  ['Onboarding Coordinator', 'Tessellate HR', 'Remote, Spain', 'InfoJobs', 7, 'new', 'ops', '2026-01-12'],
  ['Customer Operations Associate', 'Marlow Shipping', 'Lisbon, Portugal', 'We Work Remotely', 6, 'new', 'cs', '2026-01-12'],
  ['Business Analyst (Junior)', 'Halcyon Bank', 'Lisbon, Portugal', 'LinkedIn', 7, 'new', 'data', '2026-01-11'],
  ['Account Coordinator', 'Juniper Events', 'Madrid, Spain', 'Indeed', 6, 'new', 'sales', '2026-01-10'],
  ['Support Engineer', 'Obsidian Cloud', 'Remote, EU', 'Remote OK', 4, 'new', 'product', '2026-01-10'],
  ['Client Services Associate', 'Northgate Funds', 'Lisbon, Portugal', 'LinkedIn', 8, 'new', 'fin', '2026-01-09'],
  ['AI Operations Assistant', 'Parallax Labs', 'Remote, EU', 'Remotive', 9, 'new', 'ops', '2026-01-09'],
  ['Marketplace Operations Associate', 'Cobble & Co', 'Porto, Portugal', 'Himalayas', 7, 'new', 'ops', '2026-01-08'],
]

/** Every job of the demo: the showcase ones, plus the rows above. All invented. */
export function demoJobs(): Job[] {
  const extra = DEMO_ROWS.map(([title, company, location, source, score, status, kind, found], i) => {
    const k = KINDS[kind]
    const remote = location.startsWith('Remote')
    const city = location.split(',')[0]
    return job({
      n: 400 + i, title, company, location, source, score, status, found_on: found, remote,
      loc_group: remote ? 'Remote' : city === 'Lisbon' ? 'Lisbon' : 'Other',
      new: found === DEMO_TODAY && score >= 7,
      fit: String(Math.max(1, score - 1)), adjustments: '+1 (entry level)',
      summary: k.summary, strengths: k.strengths, to_learn: k.to_learn,
      red_flags: score <= 4 ? 'Asks for 5+ years in the same role' : '',
      unknowns: score % 2 ? 'Salary not stated' : 'Contract type not stated',
      trust: score <= 5 ? 'Check' : 'Trusted',
      applied_on: ['applied', 'interview', 'rejected'].includes(status) ? found : '',
      key_tags: [[score <= 5 ? 'Check' : 'Trusted', score <= 5 ? 'neutral' : 'good'],
        [remote ? location : city, remote || city === 'Lisbon' ? 'good' : 'neutral'],
        score <= 4 ? ['Senior (5+ years)', 'risk'] : ['Entry level', 'good']],
      description: `${company} is hiring a ${title} (${location}). You will work with several teams, keep customers ` +
        `informed and improve how the work gets done. We look for clear communication, care for details and ` +
        `curiosity about data and tools. English is required; Portuguese or Spanish is a plus. ` +
        `This is an invented job ad for the Job2go demo.`,
    })
  })
  const tags = (j: Job): Job => ({ ...j, tags: j.key_tags, description: j.description || j.summary })
  return [sampleBestMatch, sampleArriving, ...sampleNewToday, ...sampleBoard.flatMap((c) => c.jobs).filter((j) => j.n >= 300), ...extra]
    .map(tags)
    .concat(demoWeekJobs().map(tags))
}

/** The jobs the demo's "Run search" finds */
export function demoSearchFinds(): Job[] {
  return [
    job({ n: 480, new: true, score: 8, title: 'Customer Onboarding Associate', company: 'Seaglass Bank', location: 'Lisbon, Portugal', source: 'LinkedIn',
      found_on: DEMO_TODAY, key_tags: [['Trusted', 'good'], ['Lisbon', 'good'], ['Entry level', 'good']], summary: KINDS.cs.summary,
      strengths: KINDS.cs.strengths, to_learn: KINDS.cs.to_learn, unknowns: 'Salary not stated' }),
    job({ n: 481, new: true, score: 7, title: 'Operations Analyst', company: 'Tamarind Freight', location: 'Remote, EU', source: 'Himalayas',
      remote: true, loc_group: 'Remote', found_on: DEMO_TODAY, key_tags: [['Trusted', 'good'], ['Remote, EU', 'good'], ['Entry level', 'good']],
      summary: KINDS.ops.summary, strengths: KINDS.ops.strengths, to_learn: KINDS.ops.to_learn, unknowns: 'Contract type not stated' }),
  ].map((j) => ({ ...j, tags: j.key_tags, description: `${j.company} is hiring a ${j.title}. This is an invented job ad for the Job2go demo.` }))
}

// ---------- The 6 sample application packs (invented, see person.en.ts / .fr.ts / .es.ts) ----------
// Each one is tailored like a real pack: its own headline and summary, the most relevant bullets
// of each job first, the skill rows and tools the job asks for, its own letter and prep sheet.
// {title} and {company} are filled in with the job's own, so other jobs can reuse the closest pack.
export type { SamplePack }
export const samplePacks = personEn.packs
export const samplePacksFor = (lang: Lang) => PEOPLE[lang].packs

/** Which sample pack fits a job best (by its title) */
export function packKeyFor(title: string): keyof typeof samplePacks {
  const t = title.toLowerCase()
  if (t.includes('implementation')) return 'impl'
  if (t.includes('onboarding')) return 'cs'
  if (t.includes('account')) return 'account'
  if (/partner|sales|business development|revenue/.test(t)) return 'sales'
  if (/product|data|analyst|ai /.test(t)) return 'productops'
  if (/customer|client|support|experience/.test(t)) return 'cs'
  return 'ops'
}

// ---------- A full week of searching: about 650 jobs, made by a small generator ----------
// Nothing is written by hand here: names are mixed from the lists below with a fixed "random" seed,
// so every visitor sees exactly the same jobs. Most are dropped by the free filters (each with its
// reason), about 120 are scored from 2 to 9.

const WEEK = ['2026-01-09', '2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14', DEMO_TODAY]
const SOURCES_MIX: [string, number][] = [['LinkedIn', 52], ['Indeed', 18], ['InfoJobs', 12], ['Himalayas', 7], ['We Work Remotely', 5], ['Remotive', 3], ['Remote OK', 3]]
const NAME_A = ['Northwind', 'Bluefin', 'Cedar', 'Lumen', 'Quartz', 'Harbor', 'Atlas', 'Nimbus', 'Ember', 'Vela', 'Orbit', 'Juniper', 'Sable', 'Tidal', 'Kestrel', 'Marble', 'Copper', 'Aster', 'Birch', 'Delta', 'Mosaic', 'Pioneer', 'Saffron', 'Willow']
const NAME_B = ['Labs', 'Systems', 'Group', 'Health', 'Logistics', 'Retail', 'Bank', 'Travel', 'Media', 'Software', 'Energy', 'Foods', 'Insurance', 'Analytics', 'Mobility', 'Partners']
const GOOD_TITLES: Record<Kind, string[]> = {
  ops: ['Operations Associate', 'Operations Coordinator', 'Business Operations Analyst', 'Service Delivery Coordinator', 'Process Improvement Assistant'],
  cs: ['Customer Success Associate', 'Customer Success Specialist', 'Client Support Specialist', 'Customer Experience Associate', 'Client Onboarding Associate'],
  data: ['Junior Data Analyst', 'Reporting Analyst', 'Business Intelligence Assistant', 'Operations Data Analyst'],
  product: ['Junior Product Owner', 'Product Support Specialist', 'Product Operations Assistant'],
  sales: ['Partnerships Associate', 'Account Coordinator', 'Inside Sales Associate', 'Business Development Associate'],
  fin: ['Client Services Associate', 'KYC Analyst (Junior)', 'Payments Operations Associate'],
}
const OTHER_TITLES = ['Warehouse Operative', 'Senior Backend Engineer', 'Head Chef', 'Registered Nurse', 'Truck Driver', 'Store Manager', 'Electrician', 'Senior DevOps Engineer', 'Dental Assistant', 'Forklift Driver']
const FAR_CITIES = ['Madrid, Spain', 'Barcelona, Spain', 'Berlin, Germany', 'Paris, France', 'Amsterdam, Netherlands', 'Munich, Germany', 'Dublin, Ireland', 'Milan, Italy', 'Remote, US only']
const NEAR = ['Lisbon, Portugal', 'Lisbon, Portugal', 'Remote, EU', 'Remote, worldwide', 'Porto, Portugal']
const LANG_RULES = ['Needs native German', 'Needs fluent Dutch', 'Needs native French', 'Needs fluent Italian']
const RED_FLAGS = ['Asks for 5+ years in a similar role', 'Pay is mostly commission', 'Vague ad with no company details', 'Needs fluent German for client calls']
// How many scored jobs get each score: a few 8-9s, many 5-7s, some low ones
const SCORE_SPREAD: [number, number][] = [[9, 3], [8, 9], [7, 17], [6, 22], [5, 18], [4, 10], [3, 7], [2, 5]]

/** A small seeded random generator (mulberry32): the same numbers every time */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let weekCache: Job[] | null = null

/** The generated week (made once, then reused) */
export function demoWeekJobs(): Job[] {
  if (weekCache) return weekCache
  const rand = seeded(20260115)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const weighted = (list: [string, number][]) => {
    let r = rand() * list.reduce((sum, [, w]) => sum + w, 0)
    for (const [value, w] of list) if ((r -= w) < 0) return value
    return list[0][0]
  }
  const company = () => `${pick(NAME_A)} ${pick(NAME_B)}`
  const kinds = Object.keys(GOOD_TITLES) as Kind[]
  const out: Job[] = []
  let n = 1000

  // 1. Scored jobs (about 90 here, plus the ~30 hand-written ones above)
  for (const [score, count] of SCORE_SPREAD) {
    for (let i = 0; i < count; i++) {
      const kind = pick(kinds)
      const k = KINDS[kind]
      const title = pick(GOOD_TITLES[kind])
      const location = score >= 7 ? pick(NEAR.slice(0, 4)) : pick(NEAR)
      const remote = location.startsWith('Remote')
      const city = location.split(',')[0]
      const found = pick(WEEK)
      const name = company()
      out.push(job({
        n: n++, title, company: name, location, source: weighted(SOURCES_MIX), score, found_on: found, remote,
        loc_group: remote ? 'Remote' : city === 'Lisbon' ? 'Lisbon' : 'Other',
        new: found === DEMO_TODAY && score >= 7,
        fit: String(Math.max(1, score - (score >= 7 ? 1 : 0))), adjustments: score >= 7 ? '+1 (home city or remote, entry level)' : '',
        summary: score >= 7 ? k.summary : score >= 5 ? `${k.summary.split(';')[0].replace(/\.$/, '')}. Some gaps to check.` : 'Only a partial fit with your profile.',
        strengths: k.strengths, to_learn: k.to_learn,
        red_flags: score <= 4 ? pick(RED_FLAGS) : '',
        unknowns: pick(['Salary not stated', 'Contract type not stated', 'Salary not stated; hybrid days not stated']),
        trust: score <= 3 ? 'Check' : 'Trusted',
        key_tags: [[score <= 3 ? 'Check' : 'Trusted', score <= 3 ? 'neutral' : 'good'],
          [remote ? location : city, remote || city === 'Lisbon' ? 'good' : 'neutral'],
          score <= 4 ? ['Senior (5+ years)', 'risk'] : ['Entry level', 'good']],
        description: `${name} is looking for a ${title} (${location}). You will work with customers and internal teams, keep ` +
          'work organised and help improve how things are done. Clear English is required. Invented job ad for the Job2go demo.',
      }))
    }
  }

  // 2. Jobs the free filters dropped, each with its reason (about 530)
  const rules: [string, string, () => Partial<Job>][] = [
    ['wrong location', 'Wrong location', () => ({ title: pick(Object.values(GOOD_TITLES).flat()), location: pick(FAR_CITIES) })],
    ['irrelevant title', 'Title you never want', () => ({ title: pick(OTHER_TITLES), location: pick([...NEAR, ...FAR_CITIES]) })],
    ['duplicate', 'Duplicate', () => ({ title: pick(Object.values(GOOD_TITLES).flat()), location: pick(NEAR) })],
    ['filtered', pick(LANG_RULES), () => ({ title: pick(Object.values(GOOD_TITLES).flat()), location: pick(NEAR) })],
    ['filtered', 'Too senior (5+ years)', () => ({ title: `Senior ${pick(Object.values(GOOD_TITLES).flat())}`, location: pick(NEAR) })],
  ]
  const ruleMix: [number, number][] = [[0, 290], [1, 120], [2, 45], [3, 45], [4, 30]]
  for (const [rule, count] of ruleMix) {
    for (let i = 0; i < count; i++) {
      const [status, reason, make] = rules[rule]
      const fields = make()
      out.push(job({
        n: n++, ...fields, title: fields.title!, company: company(), score: 0, status, source: weighted(SOURCES_MIX),
        found_on: pick(WEEK), filter_reason: rule === 3 ? pick(LANG_RULES) : reason, summary: '', key_tags: [],
      }))
    }
  }
  weekCache = out
  return out
}
