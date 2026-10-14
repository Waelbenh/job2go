import { siIndeed } from 'simple-icons'

// The job sources the agent really uses (config.yaml: sites, remote_sources, infojobs_email).
// Google Jobs exists in the code but is switched off, so it is not shown.
// Logos: the official SVG from Simple Icons where one exists (only Indeed today; LinkedIn asked to be
// removed from Simple Icons). The others get a small letter mark in their brand color.
// Logos and names belong to their owners (said in the page footer).
export interface Source {
  name: string
  /** brand color of the tile */
  color: string
  /** Simple Icons path, when there is an official logo */
  icon?: string
  /** letters shown when there is no logo */
  mark?: string
}

export const SOURCES: Source[] = [
  { name: 'LinkedIn', color: '#0a66c2', mark: 'in' },
  { name: 'Indeed', color: `#${siIndeed.hex}`, icon: siIndeed.path },
  { name: 'InfoJobs', color: '#167db7', mark: 'iJ' },
  { name: 'Remotive', color: '#4c3fe0', mark: 'R' },
  { name: 'Remote OK', color: '#e5483f', mark: 'OK' },
  { name: 'Himalayas', color: '#5a5be8', mark: 'H' },
  { name: 'We Work Remotely', color: '#2b2f38', mark: 'WWR' },
]
