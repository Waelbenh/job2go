import type { Job } from '@/lib/types'
import { getLang, t } from '.'

/** A job's ad in the current language. The demo's invented ads (they end with "Job2go demo.") are
 *  written again from a translated template; any other text is shown as it is (or its translation). */
export function localDescription(job: Job): string {
  const text = job.description
  if (getLang() === 'en' || !text.trim().endsWith('Job2go demo.')) return t(text)
  return t('{company} is hiring a {title} ({location}). You will work with several teams, keep customers informed and improve how the work gets done. We look for clear communication, care for details and curiosity about data and tools. English is required; Portuguese or Spanish is a plus. This is an invented job ad for the Job2go demo.',
    { company: job.company, title: job.title, location: job.location })
}
