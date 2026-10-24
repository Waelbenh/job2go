import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { LangSwitch } from '@/components/theme/LangSwitch'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const LINKS = [
  ['How it works', 'how-it-works'],
  ['Features', 'features'],
  ['Built by Wael', 'built-by'],
] as const

/** The section you are reading: the last one whose start has passed the upper part of the screen */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight * 0.4
      let current: string | null = null
      for (const [, id] of LINKS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return active
}

/** The floating glass bar at the top of the showcase (idea from Raycast).
 *  Each link glides to its section (smooth scrolling is set in index.css), and the link of the
 *  section you are reading lights up, so the bar follows you down the page. */
export function ShowcaseNav() {
  const active = useActiveSection()
  return (
    <div className="sticky top-3 z-50 px-3 sm:top-4 sm:px-6">
      <nav aria-label={t('Main')} className="glass mx-auto flex h-14 max-w-[1200px] items-center gap-2 rounded-lg pr-2 pl-4 sm:gap-6">
        <a href="#top" aria-label={t('Job2go AI, back to the top')} className="rounded-md">
          <Logo />
        </a>
        <ul className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map(([label, id]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={active === id ? 'location' : undefined}
                className={cn(
                  'relative block rounded-md px-3 py-2 transition-colors duration-200 hover:bg-charcoal-800 hover:text-ink',
                  active === id ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {t(label)}
                {/* a small green line under the section you are in */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 -bottom-px h-0.5 origin-center rounded-full bg-go-500 shadow-[0_0_10px_var(--color-go-glow)] transition-transform duration-300 ease-go',
                    active === id ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </a>
            </li>
          ))}
        </ul>
        <LangSwitch className="ml-auto md:ml-0" />
        <ThemeToggle className="sm:-ml-4" />
        <Button asChild size="sm" className="shrink-0 sm:-ml-4">
          <a href="/demo"><span className="sm:hidden">Demo</span><span className="hidden sm:inline">{t('Try the demo')}</span></a>
        </Button>
      </nav>
    </div>
  )
}
