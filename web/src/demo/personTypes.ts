// The shape of the demo person (person.en.ts, person.fr.ts, person.es.ts)

export type SkillKey = 'process_improvement' | 'operations' | 'data' | 'client_work'
export type PackKey = 'cs' | 'ops' | 'sales' | 'account' | 'productops' | 'impl'

export interface SamplePack {
  quality: string
  headline: string
  summary: string
  /** for each job in profile.experience: which highlights, in which order ([] = left out) */
  bullets: number[][]
  /** which profile.projects, in which order */
  projects: number[]
  skills: SkillKey[]
  tools: string[]
  letter: string[]
  prep: { plain: string; questions: [string, string][]; ask: string[]; watch: string[] }
}

export interface DemoProfile {
  name: string
  location: string
  headline: string
  contact: { phone: string; email: string; linkedin: string; portfolio: string }
  summary: string
  languages: string[]
  experience: { role: string; company: string; location: string; dates: string; highlights: string[] }[]
  projects: { name: string; type: string; dates: string; highlights: string[] }[]
  education: { degree: string; school: string; year: number }[]
  skills: Record<SkillKey, string[]>
  tools_inventory: Record<string, string[]>
  what_i_want: string
  deal_breakers: string
}

export interface DemoPerson {
  profile: DemoProfile
  packs: Record<PackKey, SamplePack>
}
