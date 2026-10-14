import { Check, Loader2 } from 'lucide-react'
import type { Tag as TagData } from '@/lib/types'
import { cn } from '@/lib/utils'

// green = good, red = risk, outline = a neutral fact, grey = the one merged "Unknown" tag
const KIND = {
  good: 'bg-go-900 text-go-400',
  risk: 'bg-[#3a1d1b] text-[#f4887e]',
  neutral: 'text-ink-muted shadow-[inset_0_0_0_1px_var(--color-charcoal-700)]',
  unknown: 'bg-charcoal-800 text-ink-muted',
}

export function Tag({ tag }: { tag: TagData }) {
  const [text, kind, tooltip] = tag
  return (
    <li title={tooltip} className={cn('rounded-sm px-2 py-0.5 text-small whitespace-nowrap', KIND[kind])}>
      {text}
    </li>
  )
}

export function TagList({ tags, className }: { tags: TagData[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <Tag key={tag[0]} tag={tag} />
      ))}
    </ul>
  )
}

/** Shown when a job has moved on: "Making pack…", "Pack ready", "Applied" ... */
export function StatusPill({ status }: { status: string }) {
  if (status === 'making pack') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-charcoal-800 px-2.5 py-1 text-small text-ink-muted">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Making pack
      </span>
    )
  }
  if (status === 'new') return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-go-900 px-2.5 py-1 text-small font-medium text-go-400">
      <Check className="size-3.5" aria-hidden /> {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
