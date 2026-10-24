// A very small translation helper. The English text IS the key: t('Try the demo') returns the
// French or Spanish version from fr.ts / es.ts, or the English text itself when there is none.
// {name} in a text is filled from `vars`. The chosen language is remembered in localStorage.
// App.tsx re-renders the whole page when the language changes, so plain t() calls are enough.
import { useSyncExternalStore } from 'react'
import { es } from './es'
import { fr } from './fr'

export type Lang = 'en' | 'fr' | 'es'
export const LANGS: Lang[] = ['en', 'fr', 'es']
const KEY = 'job2go-lang'
const DICTS: Record<Lang, Record<string, string>> = { en: {}, fr, es }

function read(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'fr' || saved === 'es' || saved === 'en') return saved
  } catch {
    // storage blocked: English
  }
  return 'en'
}

let current: Lang = read()
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = current

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  document.documentElement.lang = lang
  try { localStorage.setItem(KEY, lang) } catch { /* not remembered, still switches */ }
  listeners.forEach((fn) => fn())
}

/** The current language; the component re-renders when it changes */
export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => current,
  )
}

/** The text in the current language (English when there is no translation) */
export function t(en: string, vars?: Record<string, string | number>): string {
  let text = DICTS[current][en] ?? en
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v))
  return text
}

/** Each item of a "a; b; c" list translated on its own (AI reasons are stored like that) */
export function tList(text: string): string {
  if (current === 'en' || !text) return text
  const whole = DICTS[current][text]
  if (whole) return whole
  return text.split(';').map((s) => t(s.trim())).join('; ')
}

/** The locale for dates and numbers */
export function locale(): string {
  return current === 'fr' ? 'fr-FR' : current === 'es' ? 'es-ES' : 'en-GB'
}
