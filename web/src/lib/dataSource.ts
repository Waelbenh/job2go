// One set of screens, two data sources (DESIGN.md "How the pieces connect"):
//   /app   -> liveSource (src/live/api.ts): your real jobs, through serve.py
//   /demo  -> demoSource (src/demo/demoSource.ts): invented sample data, kept in the browser
// The pages only talk to this interface (useData), so they never know which one they use.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ActionResult, Job, LearningGuide, PageData } from './types'

export type ProfileValue = string | number | ProfileValue[] | { [key: string]: ProfileValue }
export type Profile = Record<string, ProfileValue>
export interface RunStatus { running: boolean; code: number | null; lines: string[]; elapsed: string }
/** Today's AI usage (llm.usage_status in Python) */
export interface Usage {
  claude_on: boolean
  claude_used: number
  claude_cap: number
  gemini: { role: string; model: string; out: boolean }[]
}
export interface NewJob { title: string; company: string; location: string; link: string; description: string }

export interface DataSource {
  jobs: () => Promise<PageData>
  job: (n: number) => Promise<Job>
  profile: () => Promise<{ profile: Profile; sections: string[] }>
  saveProfile: (section: string, value: ProfileValue) => Promise<ActionResult>
  runStatus: () => Promise<RunStatus>
  usage: () => Promise<Usage>
  markApplied: (n: number) => Promise<ActionResult>
  undoApplied: (n: number) => Promise<ActionResult>
  notInterested: (n: number) => Promise<ActionResult>
  undoNotInterested: (n: number) => Promise<ActionResult>
  setStatus: (n: number, status: string) => Promise<ActionResult>
  addDescription: (n: number, description: string) => Promise<ActionResult>
  addJob: (job: NewJob) => Promise<ActionResult>
  makePack: (n: number) => Promise<ActionResult>
  remakePack: (n: number, note: string) => Promise<ActionResult>
  makeGuide: (n: number) => Promise<ActionResult>
  guide: (n: number) => Promise<LearningGuide>
  runSearch: () => Promise<ActionResult>
  /** where a pack file opens (files.cv is e.g. "applications/x_12/..._CV.pdf") */
  fileUrl: (path: string) => string
}

/** The data source and the address the app lives at ("/app" or "/demo") */
export const DataContext = createContext<{ source: DataSource; base: string } | null>(null)

export function useData(): DataSource {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData() must be used inside the app layout')
  return value.source
}

/** "/app" or "/demo", for links: `${base}/jobs` */
export function useBase(): string {
  return useContext(DataContext)?.base ?? '/app'
}

export interface JobsState {
  data: PageData | null
  error: string | null
  /** load again (after every button) */
  reload: () => Promise<void>
}

const LOAD_ERROR = 'Could not load your jobs. Is serve.py running? Start it in Terminal with: python serve.py'

/** Loads the jobs once, and again whenever reload() is called */
export function useJobsLoader(source: DataSource): JobsState {
  const [data, setData] = useState<PageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      setData(await source.jobs())
      setError(null)
    } catch {
      setError(LOAD_ERROR)
    }
  }, [source])
  useEffect(() => {
    // the first load; its result arrives later (then), not during this effect
    source.jobs().then(setData, () => setError(LOAD_ERROR))
  }, [source])
  return { data, error, reload }
}

export const JobsContext = createContext<JobsState | null>(null)

/** The jobs, for any page inside the app */
export function useJobs(): JobsState {
  const state = useContext(JobsContext)
  if (!state) throw new Error('useJobs() must be used inside the app layout')
  return state
}
