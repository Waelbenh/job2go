import { cn } from '@/lib/utils'

/** A station on the pipeline line: a hollow ring that fills green (with a glow) when lit. */
export function Station({ lit, small = false, className }: { lit: boolean; small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative z-10 grid shrink-0 place-items-center rounded-full bg-charcoal-900 transition-[border-color,box-shadow] duration-500',
        small ? 'size-3.5 border-[1.5px]' : 'size-6 border-2',
        lit ? 'border-go-500 shadow-glow-go' : 'border-charcoal-700',
        className,
      )}
    >
      <span className={cn('rounded-full transition-colors duration-500', small ? 'size-1.5' : 'size-2.5',
        lit ? 'bg-go-500' : 'bg-transparent')} />
    </span>
  )
}
