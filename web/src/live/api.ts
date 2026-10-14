// The ONLY place that talks to serve.py (your real data). The code checker blocks fetch()
// everywhere else, and the public showcase/demo may not import this folder (see .oxlintrc.json).
// While developing, Vite sends /api and /applications to serve.py (vite.config.ts).
import type { DataSource, NewJob, Profile, ProfileValue, RunStatus, Usage } from '@/lib/dataSource'
import type { ActionResult, Job, LearningGuide, PageData } from '@/lib/types'

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json() as Promise<T>
}

/** A button: POST to serve.py. The X-Pack-Button header proves the request comes from our own page. */
async function post(url: string, body?: Record<string, string>): Promise<ActionResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-Pack-Button': '1', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const result = (await response.json()) as ActionResult
    return result
  } catch {
    return { ok: false, message: 'Could not reach serve.py. Is it running? (python serve.py)' }
  }
}

/** My profile: save one section of profile.yaml (serve.py backs it up first) */
async function put(url: string, value: unknown): Promise<ActionResult> {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'X-Pack-Button': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    return (await response.json()) as ActionResult
  } catch {
    return { ok: false, message: 'Could not reach serve.py. Is it running? (python serve.py)' }
  }
}

/** Your real data, through serve.py */
export const liveSource: DataSource = {
  profile: () => getJson<{ profile: Profile; sections: string[] }>('/api/profiles/default'),
  saveProfile: (section: string, value: ProfileValue) => put(`/api/profiles/default/${section}`, value),

  jobs: () => getJson<PageData>('/api/jobs'),
  job: (n: number) => getJson<Job>(`/api/jobs/${n}`),
  runStatus: () => getJson<RunStatus>('/api/run'),
  usage: () => getJson<Usage>('/api/usage'),

  markApplied: (n: number) => post(`/api/applied/${n}`),
  undoApplied: (n: number) => post(`/api/undo/${n}`),
  notInterested: (n: number) => post(`/api/notinterested/${n}`),
  undoNotInterested: (n: number) => post(`/api/interested/${n}`),
  setStatus: (n: number, status: string) => post(`/api/jobs/${n}/status`, { status }),
  addDescription: (n: number, description: string) => post(`/api/description/${n}`, { description }),
  addJob: (job: NewJob) => post('/api/manual', { ...job }),
  /** Runs tailor.py: takes a few minutes and uses AI quota */
  makePack: (n: number) => post(`/api/make/${n}`),
  /** Makes the pack again (optionally with what should be better); replaces the old one when done */
  remakePack: (n: number, note: string) => post(`/api/remake/${n}`, { note }),
  /** A learning guide for the job's "To learn" items (uses AI quota) */
  makeGuide: (n: number) => post(`/api/guide/${n}`),
  guide: (n: number) => getJson<LearningGuide>(`/api/jobs/${n}/guide`),
  /** Starts run.py in the background: uses AI quota */
  runSearch: () => post('/api/run'),
  /** serve.py serves the pack files (only inside data/applications/) */
  fileUrl: (path: string) => `/${path}`,
}
