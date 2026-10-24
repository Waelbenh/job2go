import { LANGS, setLang, t, useLang, type Lang } from '@/i18n'
import { cn } from '@/lib/utils'

const NAMES: Record<Lang, string> = { en: 'English', fr: 'Français', es: 'Español' }

/** EN / FR / ES: three small buttons, the current one lit. Remembered in localStorage. */
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang()
  return (
    <div role="group" aria-label={t('Language')} className={cn('inline-flex shrink-0 items-center rounded-md', className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => setLang(l)}
          aria-pressed={l === lang}
          aria-label={NAMES[l]}
          title={NAMES[l]}
          className={cn('rounded-sm px-1.5 py-1 font-mono text-[0.7rem] uppercase transition-colors',
            l === lang ? 'text-ink' : 'text-ink-faint hover:text-ink')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
