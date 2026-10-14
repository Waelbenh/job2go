import type { CSSProperties, ReactNode, Ref } from 'react'
import { cn } from '@/lib/utils'

/** A desktop-app window frame (three dots + title) around a picture of the app.
 *  `inert`: it is a picture, so nothing inside can be clicked or reached with Tab. */
export function AppWindow({ children, className, style, bodyClassName, bodyStyle, ref }: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  bodyClassName?: string
  bodyStyle?: CSSProperties
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      inert
      role="img"
      aria-label="Preview of the Job2go AI app with sample jobs"
      className={cn('overflow-hidden rounded-xl bg-charcoal-900 shadow-depth-3 ring-1 ring-hairline', className)}
      style={style}
    >
      <div className="flex h-10 items-center gap-2 border-b border-hairline bg-charcoal-950/60 px-4">
        {[0, 1, 2].map((n) => (
          <span key={n} className="size-3 rounded-full bg-[#4a4d55]" />
        ))}
        <span className="flex-1 text-center text-small text-ink-muted">Job2go AI</span>
        <span className="w-12" />
      </div>
      <div data-window-body className={cn('@container relative flex h-[calc(100%-2.5rem)]', bodyClassName)} style={bodyStyle}>
        {children}
      </div>
    </div>
  )
}
