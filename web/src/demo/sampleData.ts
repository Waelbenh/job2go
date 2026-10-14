// ============================================================================
// ALL sample data for the public showcase ("/") and the demo ("/demo").
// Everything here is INVENTED: people, companies, cities, numbers.
// It is published with the showcase, so it must never contain real jobs,
// real numbers from data/jobs.csv, or anything from profile.yaml.
// The showcase and demo read ONLY this file - never serve.py or the data/ folder
// (the code checker blocks it, see .oxlintrc.json).
// ============================================================================
import type { Job, Stats } from '@/lib/types'

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
    'An operations role at a mid-size software company. Your project coordination and reporting experience covers the main duties.',
  strengths: 'Three years of project coordination; SQL and spreadsheet reporting; fluent English and Portuguese',
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
// The /demo app: a whole invented job search for an invented person, Alex Duarte.
// ============================================================================

/** "Today" in the demo (the sample jobs above were found on this day) */
export const DEMO_TODAY = '2026-01-15'

/** The demo person's profile (the "My profile" page and every sample CV). Invented from start to end. */
export const sampleProfile = {
  name: 'Alex Duarte',
  location: 'Lisbon, Portugal',
  headline: 'Customer Operations | Client Onboarding | Data-minded',
  contact: { phone: '+351 912 000 000', email: 'alex.duarte@example.com', linkedin: 'linkedin.com/in/alexduarte-demo', portfolio: 'alexduarte.example.com' },
  summary: 'Customer operations professional with almost five years in B2B onboarding, account care and sales support.\nComfortable between clients, sales and operations teams, and with the data behind them (SQL, Sheets, Looker Studio).\nWorks in Portuguese, English and Spanish.\n',
  languages: ['Portuguese (native)', 'English (C1)', 'Spanish (B2)', 'French (A2)'],
  experience: [
    { role: 'Client Onboarding & Operations Coordinator', company: 'Tidewater Logistics', location: 'Lisbon', dates: 'Mar 2023 - Dec 2025',
      highlights: [
        'Ran onboarding for 45 B2B clients a year, from kickoff call to first live shipment, cutting average time-to-go-live from 6 to 4 weeks.',
        'Managed day-to-day contact for 20 accounts worth EUR 1.2M a year, with a 96% renewal rate.',
        'Redesigned the hand-off between sales and operations, removing 3 manual steps and halving hand-off errors.',
        'Built a weekly SQL and Google Sheets report on shipment delays, used by the operations lead and 2 account managers.',
        'Spotted upsell needs in quarterly reviews and passed 14 qualified leads to sales, 6 of which closed.',
      ] },
    { role: 'Customer Success Associate', company: 'Brightline Retail', location: 'Lisbon', dates: 'Jun 2021 - Feb 2023',
      highlights: [
        'Handled 60+ customer conversations a day by chat, email and phone in Portuguese, English and Spanish, keeping CSAT at 94%.',
        'Looked after 35 small-business wholesale customers: orders, invoices and yearly renewals.',
        'Wrote and updated 40 help-center articles in Zendesk, cutting repeat tickets about returns by 18%.',
        'Tracked ticket trends in Zendesk Explore and brought the top 5 issues to the product team every month.',
      ] },
    { role: 'Sales Development Intern', company: 'Orla Software', location: 'Porto', dates: 'Sep 2020 - May 2021',
      highlights: [
        'Researched and qualified 300+ small-business leads in Portugal and Spain with LinkedIn Sales Navigator and HubSpot.',
        'Booked 42 discovery calls for 3 account executives through cold email and LinkedIn outreach.',
        'Kept HubSpot pipeline data clean and sent a weekly activity report to the sales manager.',
      ] },
    { role: 'Student Ambassador (part-time)', company: 'Atlantic University', location: 'Lisbon', dates: 'Oct 2018 - Jun 2020',
      highlights: [
        'Presented the business programme to 1,500+ prospective students at 25 open days and school visits.',
        'Coordinated 12 volunteers during orientation week.',
      ] },
  ],
  projects: [
    { name: 'Onboarding health dashboard', type: 'Personal project', dates: '2025',
      highlights: ['Built a Looker Studio dashboard on public sample data that tracks onboarding steps, delays and early churn signals.'] },
    { name: 'Support ticket classifier', type: 'Personal project', dates: '2024',
      highlights: ['Used Python and an AI API to tag 2,000 sample support tickets by topic and urgency; 88% matched manual tags.'] },
  ],
  education: [
    { degree: 'MSc Management (Marketing and Operations)', school: 'Tagus School of Management, Lisbon', year: 2020 },
    { degree: 'BSc Business Administration', school: 'Atlantic University, Lisbon', year: 2018 },
  ],
  skills: {
    customer_success: ['Client onboarding', 'Account management', 'Renewals', 'Quarterly business reviews', 'CSAT and NPS'],
    operations: ['Process mapping', 'Standard operating procedures', 'Project coordination', 'Cross-team hand-offs'],
    sales: ['Prospecting', 'Discovery calls', 'Pipeline hygiene', 'Upsell spotting'],
    data: ['SQL (intermediate)', 'Google Sheets and Excel (advanced)', 'Looker Studio', 'Power BI (basic)'],
  },
  tools_inventory: {
    crm_and_support: ['HubSpot', 'Salesforce', 'Zendesk', 'Intercom', 'LinkedIn Sales Navigator'],
    work_management: ['Jira', 'Asana', 'Notion', 'Slack'],
    office_and_data: ['Google Workspace', 'Microsoft 365', 'Looker Studio', 'Power BI', 'Zapier'],
  },
  what_i_want: 'Junior to mid-level roles in customer success, onboarding, operations or account management.\nLisbon or Porto, or remote in the EU.\n',
  deal_breakers: '- Senior roles asking for 5+ years in the exact role.\n- Commission-only sales.\n- Roles that need fluent German or Dutch.\n',
}

// What each kind of role says about the person (the AI's "strengths / to learn / red flags")
const KINDS = {
  ops: { strengths: 'Project coordination across teams; SQL and spreadsheet reporting; onboarding experience', to_learn: 'Their internal ticketing tool; release planning', summary: 'An operations role where your coordination and reporting work covers most duties.' },
  cs: { strengths: 'Three years of customer-facing work; three languages; clear written help articles', to_learn: 'Their CRM workflows; renewal and churn metrics', summary: 'A customer success role that fits your support background and languages.' },
  data: { strengths: 'SQL and spreadsheet reporting; weekly reports for an operations lead', to_learn: 'Advanced Power BI; statistics basics', summary: 'A junior analyst role; your reporting work is a good start, the tools need some practice.' },
  product: { strengths: 'Project coordination; customer insight from support work; small AI tool you built', to_learn: 'User story writing; product analytics tools', summary: 'A junior product role; strong on customer insight, lighter on product tools.' },
  sales: { strengths: 'Customer communication in three languages; onboarding experience', to_learn: 'Their sales CRM; pipeline forecasting', summary: 'A partnerships role that values languages and client communication.' },
  fin: { strengths: 'Customer communication in three languages; careful process work', to_learn: 'Forex and CFD trading basics; KYC procedures in financial services', summary: 'A client role at a trading firm; the industry is new to you, the customer work is not.' },
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

// ---------- The 6 sample application packs (invented) ----------
// Each one is tailored like a real pack: its own headline and summary, the most relevant bullets
// of each job first, the skill rows and tools the job asks for, its own letter and prep sheet.
// {title} and {company} are filled in with the job's own, so other jobs can reuse the closest pack.

export interface SamplePack {
  quality: string
  headline: string
  summary: string
  /** for each job in sampleProfile.experience: which highlights, in which order ([] = left out) */
  bullets: number[][]
  projects: number[]
  skills: (keyof typeof sampleProfile.skills)[]
  tools: string[]
  letter: string[]
  prep: { plain: string; questions: [string, string][]; ask: string[]; watch: string[] }
}

export const samplePacks: Record<'cs' | 'ops' | 'sales' | 'account' | 'productops' | 'impl', SamplePack> = {
  cs: {
    quality: '7.9',
    headline: 'Client Onboarding | Customer Success | Portuguese, English, Spanish',
    summary: 'Customer success professional applying for the {title} role, with three years of B2B onboarding and account care. Took 45 clients a year from kickoff to go-live and cut time-to-go-live from 6 to 4 weeks. Calm on calls, organised in the CRM, and fluent in Portuguese, English and Spanish.',
    bullets: [[0, 1, 2], [0, 2, 1], [1], []],
    projects: [0],
    skills: ['customer_success', 'operations', 'data'],
    tools: ['HubSpot', 'Zendesk', 'Intercom', 'Google Workspace', 'Looker Studio'],
    letter: [
      '{company} promises customers a smooth first month, and that first month is the part of the job I know best. I am applying for the {title} role because onboarding is where I have done my most measurable work.',
      'At Tidewater Logistics I ran onboarding for about 45 B2B clients a year, from the kickoff call to the first live shipment. By agreeing clear milestones with each client and fixing the hand-off between sales and operations, I brought the average time-to-go-live down from six weeks to four. I also stayed the day-to-day contact for 20 accounts afterwards, and 96% of them renewed.',
      'Before that, at Brightline Retail, I handled more than 60 customer conversations a day in Portuguese, English and Spanish while keeping satisfaction at 94%. I learned to write things down well: the 40 help-center articles I wrote cut repeat questions about returns by 18%. Your clients across Iberia would get the same care in their own language.',
      'I like to see the data behind the work. A small Looker Studio dashboard I built tracks onboarding steps and early warning signs of churn, and I would be glad to bring that habit to your team.',
      'I would welcome a conversation about how I could help new {company} customers get value quickly.',
    ],
    prep: {
      plain: 'You will guide new business customers from signing to using the product well: kickoff calls, setup, training and the first check-ins. Success is measured by time-to-go-live and early retention.',
      questions: [
        ['Walk us through an onboarding you ran from start to finish.', 'Use a Tidewater client: kickoff, agreed milestones, the blocker you removed, go-live in 4 weeks instead of 6.'],
        ['How do you handle a client who is unhappy in the first weeks?', 'Listen first, agree one concrete next step and a date, then follow up before the date. Give the Brightline CSAT 94% example.'],
        ['How do you know an onboarding is going well?', 'Milestones on time, product used weekly, no open blockers. Mention your onboarding health dashboard.'],
        ['Tell us about a process you improved.', 'The sales-to-operations hand-off: 3 manual steps removed, hand-off errors halved.'],
        ['Why {company}?', 'Link their customers and markets to your languages and your onboarding numbers.'],
      ],
      ask: ['What does a great first 90 days look like for a new customer?', 'How are onboarding and account management split?', 'Which tools does the team use day to day?'],
      watch: ['Do not claim experience with their exact product; say how quickly you learned Zendesk and HubSpot.', 'Keep numbers honest: 45 clients a year, 96% renewal on 20 accounts.'],
    },
  },
  ops: {
    quality: '8.3',
    headline: 'Operations Coordination | Process Improvement | Reporting',
    summary: 'Operations coordinator applying for the {title} role, with three years keeping B2B work on time across sales, operations and clients. Redesigned a cross-team hand-off that halved errors, and built the weekly delay report the operations lead used. Strong in SQL and Sheets, at ease with checklists and owners.',
    bullets: [[2, 3, 0], [3, 2], [2], [1]],
    projects: [0],
    skills: ['operations', 'data', 'customer_success'],
    tools: ['Jira', 'Asana', 'Notion', 'Google Workspace', 'Looker Studio', 'Microsoft 365'],
    letter: [
      '{company} is growing fast, and growing teams need someone who keeps the daily work moving and notices where it gets stuck. That is the work I enjoy most, which is why I am applying for the {title} role.',
      'At Tidewater Logistics I coordinated work between sales, operations and our clients. When I saw the same mistakes repeating at the hand-off between sales and operations, I mapped the process with both teams, removed three manual steps and wrote a short checklist. Hand-off errors fell by half. I also built a weekly SQL and Google Sheets report on shipment delays that the operations lead and two account managers used to plan their week.',
      'At Brightline Retail I learned that good operations start with good information. Every month I pulled ticket trends from Zendesk and brought the top five issues to the product team, which helped them fix the most expensive problems first.',
      'I am organised without being rigid: I like clear owners, simple tools such as Asana or Notion, and numbers that everyone can read. I also coordinated twelve volunteers for a university orientation week, so I know how to keep many people pointed in the same direction.',
      'I would be glad to talk about how I could support the {company} team.',
    ],
    prep: {
      plain: 'You keep daily operations running: tracking tasks, coordinating teams, spotting delays and improving processes. Expect questions on prioritising, tools and data.',
      questions: [
        ['Tell us about a process you improved.', 'The sales-to-operations hand-off at Tidewater: mapped with both teams, 3 steps removed, errors halved.'],
        ['How do you prioritise when everything is urgent?', 'Impact on the client first, then deadlines; make the order visible to the team in the shared board.'],
        ['Which numbers would you watch in this role?', 'On-time rate, open issues by age, and the top causes of delay. Mention your weekly delay report.'],
        ['How comfortable are you with data?', 'SQL (intermediate) and advanced Sheets; give the delay report as the example.'],
        ['Describe working with a difficult stakeholder.', 'Agree the shared goal, show the data, offer two options with a recommendation.'],
      ],
      ask: ['Which process causes the most pain today?', 'Which tools does the team use to track work?', 'How is success measured after six months?'],
      watch: ['Do not oversell SQL: say intermediate.', 'Bring one concrete improvement idea after reading their job ad.'],
    },
  },
  sales: {
    quality: '7.6',
    headline: 'Partnerships | B2B Sales Support | Client Relationships',
    summary: 'Client-facing professional applying for the {title} role, with sales development and account experience in Portugal and Spain. Booked 42 discovery calls as an SDR and later passed 14 qualified upsell leads to sales, 6 of which closed. Builds trust in Portuguese, English and Spanish.',
    bullets: [[4, 1, 0], [1, 0], [0, 1], [0]],
    projects: [],
    skills: ['sales', 'customer_success', 'data'],
    tools: ['HubSpot', 'Salesforce', 'LinkedIn Sales Navigator', 'Google Workspace'],
    letter: [
      'Partnerships work because two companies trust each other, and that trust is built one conversation at a time. {company} works with partners across Iberia, and I am applying for the {title} role because I have spent my career in exactly those conversations.',
      'I started in sales development at Orla Software, where I researched and qualified more than 300 small-business leads in Portugal and Spain and booked 42 discovery calls for three account executives. I learned to open a conversation without a script and to know quickly when there is a real fit.',
      'At Tidewater Logistics I moved to the other side of the relationship: I was the day-to-day contact for 20 B2B accounts worth 1.2 million euros a year, and 96% of them renewed. In quarterly reviews I listened for new needs and passed 14 qualified opportunities to our sales team; six of them closed.',
      'I keep the CRM clean, I follow up when I say I will, and I can work in Portuguese, English and Spanish. I would bring that mix of curiosity and discipline to your partner pipeline.',
      'I would welcome a conversation about the role and about the partners {company} wants to grow next.',
    ],
    prep: {
      plain: 'You will find, sign and grow partner companies: research, outreach, first calls, simple agreements and regular check-ins. Expect a short role play.',
      questions: [
        ['How would you find new partners for us?', 'Map the segments, list 30 targets in Sales Navigator, warm intro where possible, track everything in the CRM.'],
        ['Tell us about a deal or opportunity you created.', 'The 14 upsell leads from quarterly reviews at Tidewater, 6 closed.'],
        ['How do you handle a "no"?', 'Ask what would need to be true, note it in the CRM, follow up when that changes.'],
        ['How do you keep a pipeline organised?', 'Clear stages, next step and date on every deal; the weekly report you sent at Orla.'],
        ['Role play: open a call with a potential partner.', 'Research first, one sentence on why them, one question about their goals, then listen.'],
      ],
      ask: ['What does a successful partner look like after one year?', 'How is the role measured: signed partners, revenue, or both?', 'Who supports the partner after signing?'],
      watch: ['You have not owned a quota; say so and point to the pipeline results you did influence.', 'Keep the 1.2M figure as account value, not sales you closed.'],
    },
  },
  account: {
    quality: '8.1',
    headline: 'Account Management | Client Relationships | Portuguese, English, Spanish',
    summary: 'Account manager applying for the {title} role, with three years of looking after B2B clients and their renewals. Managed 20 accounts worth EUR 1.2M a year with a 96% renewal rate, and turned client reviews into new business. Works in Portuguese, English and Spanish.',
    bullets: [[1, 4, 0], [1, 0], [1], [0]],
    projects: [],
    skills: ['customer_success', 'sales', 'data'],
    tools: ['Salesforce', 'HubSpot', 'Zendesk', 'Microsoft 365'],
    letter: [
      '{company} serves clients in several languages and markets, and keeping them for years matters as much as winning them. I am applying for the {title} role because client relationships are where my results are strongest.',
      'At Tidewater Logistics I was the main day-to-day contact for 20 B2B accounts worth 1.2 million euros a year. I ran their quarterly reviews, solved problems before they became complaints and kept a renewal rate of 96%. Those reviews were also where I found growth: I passed 14 qualified upsell opportunities to our sales team, and six of them closed.',
      'At Brightline Retail I looked after 35 small-business wholesale customers, handling their orders, invoices and yearly renewals, while answering more than 60 customer messages a day in Portuguese, English and Spanish. That taught me to be both fast and careful.',
      'I am new to your industry, and I would prepare for that seriously: I learn products quickly, I ask good questions, and I always follow the rules that protect the client. I already use Salesforce and HubSpot daily.',
      'I would be glad to talk about how I could look after your clients.',
    ],
    prep: {
      plain: 'You will own a group of client accounts: regular contact, solving issues, renewals and spotting chances to grow each account. Expect questions on retention and on learning a new industry.',
      questions: [
        ['How do you keep a client for years?', 'Regular reviews, solve small issues fast, know their goals. The 96% renewal rate on 20 accounts.'],
        ['Tell us about growing an account.', 'Upsell needs found in quarterly reviews: 14 leads, 6 closed.'],
        ['Our industry is new to you. How will you get up to speed?', 'A 30-day learning plan, shadow senior colleagues, keep a glossary; mention how fast you learned logistics.'],
        ['How do you handle an angry client?', 'Listen, own the next step, give a date, follow up early.'],
        ['Which language would you use with which clients?', 'Portuguese and Spanish natively for Iberia, English for the rest; French basic.'],
      ],
      ask: ['How many accounts would I manage, and how big are they?', 'How are renewals and upsells measured?', 'What training is there on the products?'],
      watch: ['Be honest that the industry is new.', 'Do not call the account value your sales.'],
    },
  },
  productops: {
    quality: '7.4',
    headline: 'Product and Customer Operations | Data and Process',
    summary: 'Operations professional applying for the {title} role, working between customers, product and data. Brought the top support issues to the product team each month, built a weekly SQL delay report, and taught an AI script to tag 2,000 tickets. Comfortable with Jira, Notion and Looker Studio.',
    bullets: [[3, 2, 0], [3, 2], [2], []],
    projects: [1, 0],
    skills: ['data', 'operations', 'customer_success'],
    tools: ['Jira', 'Notion', 'Looker Studio', 'Power BI', 'Zapier'],
    letter: [
      'Good products are built on good feedback, and {company} clearly takes feedback seriously. I am applying for the {title} role because I have spent the last years turning what customers say into information a product team can use.',
      'At Brightline Retail I tracked support ticket trends in Zendesk Explore and brought the five biggest issues to the product team every month. I also rewrote 40 help-center articles, which cut repeat questions about returns by 18%. That showed me how much a small process change can save.',
      'At Tidewater Logistics I built a weekly SQL and Google Sheets report on shipment delays and redesigned the hand-off between sales and operations, halving hand-off errors. In my own time I built a Looker Studio dashboard for onboarding health, and a small Python script that uses an AI model to tag 2,000 sample support tickets by topic and urgency, matching manual tags 88% of the time.',
      'I would bring that mix of customer understanding, structure and data to your product operations: clean processes, clear documentation in Notion or Jira, and numbers the whole team trusts.',
      'I would welcome a conversation about the role.',
    ],
    prep: {
      plain: 'You will support the product team with processes, data and customer feedback: tracking releases, cleaning up tools, preparing reports and making sure feedback reaches the right people.',
      questions: [
        ['How have you turned customer feedback into product changes?', 'Monthly top-5 issues from Zendesk Explore to the product team at Brightline.'],
        ['Show us your data skills.', 'Weekly SQL delay report; Looker Studio onboarding dashboard; AI ticket tagging at 88% match.'],
        ['How would you organise our release notes or roadmap?', 'One source of truth in Jira or Notion, owners and dates, a short weekly summary.'],
        ['What would you do in your first month?', 'Meet each team, list the top 5 pains, fix one quick win, propose one bigger change.'],
        ['Tell us about a tool you set up.', 'The help-center rewrite in Zendesk and the hand-off checklist.'],
      ],
      ask: ['Which processes slow the product team down today?', 'How does feedback reach the team now?', 'Which data sources would I work with?'],
      watch: ['You have not worked in a product team directly; frame it as working closely with one.', 'The AI script is a personal project with sample data.'],
    },
  },
  impl: {
    quality: '8.4',
    headline: 'Implementation | Client Onboarding | Process and Data',
    summary: 'Implementation-minded onboarding specialist applying for the {title} role. Took 45 B2B clients a year from contract to go-live, mapped their processes, and cut time-to-go-live from 6 to 4 weeks. Documents setups clearly and checks results with data (SQL, Sheets, Looker Studio).',
    bullets: [[0, 2, 3], [2, 3], [2], []],
    projects: [0],
    skills: ['customer_success', 'operations', 'data'],
    tools: ['Jira', 'Asana', 'HubSpot', 'Zapier', 'Google Workspace'],
    letter: [
      'An implementation is the moment a customer decides whether a purchase was a good idea. {company} sells software that changes how teams work, and I am applying for the {title} role because I have spent three years making that moment go well.',
      'At Tidewater Logistics I ran the onboarding of about 45 B2B clients a year. For each one I mapped how they worked, agreed the setup and the milestones, and coordinated our operations team until the first live shipment. By standardising the kickoff and fixing the hand-off between sales and operations, I cut the average time-to-go-live from six weeks to four and halved hand-off errors.',
      'I document as I go. At Brightline Retail I wrote 40 help-center articles that reduced repeat questions by 18%, and I check my work with data: the weekly SQL report I built on delays became part of the operations lead\'s weekly routine. I also built a small onboarding health dashboard in Looker Studio to spot projects at risk early.',
      'I am comfortable with tools such as Jira, Asana, HubSpot and Zapier, and I learn new systems quickly by setting them up myself.',
      'I would be glad to talk about how I could help {company} customers go live faster.',
    ],
    prep: {
      plain: 'You will set up the software for new customers: understand their process, configure the product, import data, train users and hand over to support. Expect a scenario question.',
      questions: [
        ['Describe an implementation you led.', 'A Tidewater client: process mapping, milestones, blocker removed, live in 4 weeks.'],
        ['A customer wants something the product cannot do. What do you do?', 'Understand the need behind it, offer the closest workaround, log the request for product.'],
        ['How do you keep several implementations on track?', 'One board in Asana or Jira, milestones and owners per client, weekly check-ins.'],
        ['How technical are you?', 'SQL intermediate, advanced Sheets, Zapier automations; quick to learn configuration.'],
        ['How do you train users who are busy?', 'Short sessions, one task each, a one-page guide afterwards.'],
      ],
      ask: ['How long does a typical implementation take today?', 'Who owns the customer after go-live?', 'Which parts of the setup are hardest for customers?'],
      watch: ['Say you have not configured their exact software yet; show how you learn tools.', 'Keep SQL at intermediate.'],
    },
  },
}

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
        summary: score >= 7 ? k.summary : score >= 5 ? `${k.summary.split(';')[0]} Some gaps to check.` : 'Only a partial fit with your profile.',
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
