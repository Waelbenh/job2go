import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

/** Placeholder for pages that are built in a later step (/demo, /app) */
export function ComingSoon({ name }: { name: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[40rem] content-center gap-5 px-6">
      <Logo />
      <h1 className="font-wide text-display-m font-semibold">{t('{name} is coming in a later step.', { name })}</h1>
      <p className="text-ink-muted">{t('For now, the showcase page is ready to look at.')}</p>
      <Button asChild variant="secondary" className="justify-self-start">
        <a href="/">{t('Back to the showcase')}</a>
      </Button>
    </main>
  )
}
