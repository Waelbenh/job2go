// The shape of the data. It matches what agent/report.py (_job_data) makes for each job,
// so the same components work with sample data (showcase, demo) and real data (/app).

/** good = green, risk = red, neutral = outline, unknown = the one grey "Unknown" tag */
export type TagKind = 'good' | 'risk' | 'neutral' | 'unknown'
/** [text, kind] or [text, kind, tooltip] — the tooltip lists what is "Not stated" */
export type Tag = [string, TagKind] | [string, TagKind, string]

/** 'hidden' = on no tab (e.g. filtered out, score below min_score) - only opened by its number */
export type JobTab = 'good' | 'maybe' | 'manual' | 'incomplete' | 'applied' | 'notint' | 'rejected' | 'hidden'

export interface Job {
  n: number // job number = its row in data/jobs.csv
  tab: JobTab
  new: boolean
  score: number // final score 1-10, 0 = not scored yet
  title: string
  company: string
  location: string
  source: string // "LinkedIn", "Remotive", "added by you" ...
  url: string
  status: string // new, pack ready, applied, interview ...
  found_on: string
  applied_on: string
  remote: boolean
  loc_group: string // your home area (e.g. 'Valencia'), 'Remote', 'Other' or 'Unknown'
  tags: Tag[]
  key_tags: Tag[] // the 3 shown on a row
  summary: string
  fit: string
  adjustments: string
  strengths: string
  to_learn: string
  red_flags: string
  unknowns: string
  trust: string
  model: string // which AI scored it
  scored_on: string
  quality: string // pack quality 1-10
  files: { cv?: string; letter?: string; prep?: string }
  short: boolean // description missing or too short
  description: string // the list (/api/jobs) leaves it out to stay small; /api/jobs/<n> has it
  // Only in real data (report.py sends them; the sample data doesn't need them)
  description_length?: number
  trust_reason?: string
  contact?: string
  language?: string // languages the job requires
  languages_preferred?: string
  pack_model?: string // which AI wrote the pack
  tool_to_learn?: string
  pack_polished?: boolean // false = the pack's polish (recruiter review) step was skipped
  filter_reason?: string // why the free filters dropped it (demo data)
}

/** agent/learning_guide.py: what to learn for one job, with links made by code (searches) */
export interface LearningGuide {
  title: string
  company: string
  made_on: string
  made_by: string
  items: {
    skill: string
    what_it_is: string
    why_this_job: string
    hours: string
    resources: { platform: string; search: string; what_you_get: string; cost: string; url: string }[]
  }[]
  week: { day: string; plan: string }[]
  interview_tip: string
}

/** Everything /api/jobs sends: the same data report.html is built from */
export interface PageData {
  updated: string
  new_when: string
  settings: { good_min: number; min_score: number; new_min: number; min_description: number }
  stats: Stats
  charts: { sources: [string, number][]; scores: [number, number][]; weeks: [string, number][] }
  jobs: Job[]
  /** the last 7 days in numbers: found -> filtered out (and why) -> scored -> good */
  funnel?: { days: number; found: number; filtered: [string, number][]; scored: number; good: number }
}

/** What every button sends back */
export interface ActionResult {
  ok: boolean
  message: string
  [key: string]: unknown
}

export interface Stats {
  tracked: number
  new_today: number
  good: number
  applied: number
}
