import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

type Theme = 'dark' | 'light'
const KEY = 'job2go-theme'

function current(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

/** Small sun/moon button: switches dark (default) and light, remembered in localStorage */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(current)
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('light', next === 'light')
    try { localStorage.setItem(KEY, next) } catch { /* storage blocked: still switches */ }
    setTheme(next)
  }
  const label = theme === 'dark' ? t('Switch to light theme') : t('Switch to dark theme')
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-charcoal-800 hover:text-ink', className)}
    >
      {theme === 'dark' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}
