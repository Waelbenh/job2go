import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'

/** Placeholder for pages that are built in a later step (/demo, /app) */
export function ComingSoon({ name }: { name: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-[40rem] content-center gap-5 px-6">
      <Logo />
      <h1 className="font-wide text-display-m font-semibold">{name} is coming in a later step.</h1>
      <p className="text-ink-muted">For now, the showcase page is ready to look at.</p>
      <Button asChild variant="secondary" className="justify-self-start">
        <a href="/">Back to the showcase</a>
      </Button>
    </main>
  )
}
