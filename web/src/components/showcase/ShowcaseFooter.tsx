import { Logo } from '@/components/brand/Logo'
import { GITHUB, LINKEDIN } from './BuiltBy'

/** The bottom of the showcase: links, and the note about logos and sample data */
export function ShowcaseFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 sm:px-6 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-10">
        <Logo />
        <p className="max-w-[60ch] text-small text-ink-muted">
          Logos belong to their owners. Job2go is not affiliated with them. Every job and company shown on this
          page is invented sample data.
        </p>
        <nav aria-label="Elsewhere" className="flex gap-5 text-small">
          <a href={LINKEDIN} target="_blank" rel="noreferrer" className="text-ink-muted transition-colors hover:text-ink">LinkedIn</a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="text-ink-muted transition-colors hover:text-ink">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}
