import { siGithub } from 'simple-icons'
import { ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Wael's public links (typed here on purpose: the showcase never reads profile.yaml)
export const LINKEDIN = 'https://www.linkedin.com/in/waelbenhaddou'
export const GITHUB = 'https://github.com/Waelbenh'

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={siGithub.path} fill="currentColor" />
    </svg>
  )
}

/** "Built by Wael": who made Job2go and why, then a small box to get in touch */
export function BuiltBy() {
  return (
    <section id="built-by" aria-labelledby="built-by-title" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-8 pb-24 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <h2 id="built-by-title" className="font-wide text-display-m font-semibold lg:text-display-l">Built by Wael</h2>
          <div className="mt-6 grid max-w-[62ch] gap-4 text-body-l text-ink-muted">
            <p>
              <span className="text-ink">Hi, I'm Wael.</span> I'm fascinated by AI agents: software that doesn't just answer
              questions but gets real work done.
            </p>
            <p>
              When my own job search in Valencia turned into hours of scrolling job boards and rewriting my CV, I saw the
              perfect problem for one. So I built Job2go: an agent that searches, filters, scores and writes, while I keep
              every decision.
            </p>
            <p>
              My background is in business and finance, with a master's at UPV focused on service design, and I love
              finding the repetitive parts of a process and automating them away.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" asChild>
              <a href={LINKEDIN} target="_blank" rel="noreferrer">LinkedIn <ExternalLink aria-hidden /></a>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <a href={GITHUB} target="_blank" rel="noreferrer"><GithubMark className="size-4" /> GitHub</a>
            </Button>
          </div>
        </div>

        {/* Contact */}
        <aside aria-labelledby="contact-title" className="self-end rounded-xl bg-charcoal-850 p-7 shadow-depth-2 ring-1 ring-hairline lg:col-span-5">
          <MessageCircle className="size-6 text-go-400" aria-hidden />
          <h3 id="contact-title" className="mt-4 font-wide text-title font-semibold">Have a question or want to work together?</h3>
          <p className="mt-2 text-ink-muted">
            I read every message. LinkedIn is the quickest way to reach me; the code lives on GitHub.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <a href={LINKEDIN} target="_blank" rel="noreferrer">Message me on LinkedIn</a>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <a href={GITHUB} target="_blank" rel="noreferrer"><GithubMark className="size-4" /> See my GitHub</a>
            </Button>
          </div>
        </aside>
      </div>
    </section>
  )
}
