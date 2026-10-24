import { RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import { LangSwitch } from '@/components/theme/LangSwitch'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { demoSource, resetDemo } from '@/demo/demoSource'
import { AppLayout } from '@/pages/app/AppLayout'
import { t } from '@/i18n'

/** "/demo": the real app's screens with invented data. Runs fully in the browser (no server, no AI),
 *  so it can be put online as a plain website. */
export function DemoApp() {
  return <AppLayout source={demoSource} base="/demo" banner={<DemoBanner />} />
}

function DemoBanner() {
  return (
    <div className="flex h-10 items-center justify-center gap-3 border-b sm:gap-4 border-hairline bg-go-900 px-4 text-small text-go-400">
      <span className="shrink-0 sm:shrink sm:truncate"><span className="sm:hidden">Demo</span><span className="hidden sm:inline">{t('Demo with sample data')}. {t('Job2go runs on your own computer.')}</span></span>
      <Link to="/" className="shrink-0 text-ink underline-offset-4 hover:underline"><span className="sm:hidden">{t('Showcase')}</span><span className="hidden sm:inline">{t('Back to the showcase')}</span></Link>
      <button
        type="button"
        onClick={() => { resetDemo(); window.location.assign('/demo') }}
        className="inline-flex shrink-0 items-center gap-1.5 text-ink underline-offset-4 hover:underline"
      >
        <RotateCcw className="size-3.5" aria-hidden /> {t('Reset demo')}
      </button>
      <LangSwitch className="text-go-400" />
      <ThemeToggle className="-ml-3 size-7 text-go-400 hover:bg-transparent" />
    </div>
  )
}
