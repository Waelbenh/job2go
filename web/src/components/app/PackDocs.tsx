import { FileText, MessagesSquare, PenLine } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const DOCS = [
  { key: 'cv', title: 'CV', note: 'Tailored to this job', icon: FileText, lines: [70, 92, 84, 60, 88, 76, 54] },
  { key: 'letter', title: 'Cover letter', note: 'One page', icon: PenLine, lines: [40, 96, 90, 94, 72, 88, 30] },
  { key: 'prep', title: 'Interview prep', note: 'Questions + your answers', icon: MessagesSquare, lines: [64, 80, 48, 86, 70, 58, 40] },
]

/** The 3 documents of an application pack, as small paper thumbnails.
 *  Used by the Packs page and the showcase tour. `show` = how many have appeared (0-3). */
export function PackDocs({ show = 3, className }: { show?: number; className?: string }) {
  const reduceMotion = useReducedMotion()
  return (
    <ul className={cn('grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3', className)}>
      {DOCS.map(({ key, title, note, icon: Icon, lines }, i) => (
        <motion.li
          key={key}
          initial={false}
          animate={i < show ? { opacity: 1, y: 0, rotate: 0 } : { opacity: 0, y: 18, rotate: i === 1 ? 0 : i === 0 ? -2 : 2 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid content-start gap-2"
        >
          {/* the "paper": light, like the real PDF */}
          <div className="aspect-[0.72] rounded-sm bg-[#f4f3ef] p-3 shadow-depth-2">
            <div className="h-2 w-1/2 rounded-full bg-[#1f4e3a]" />
            <div className="mt-1 h-1 w-1/3 rounded-full bg-[#b9b8b2]" />
            <div className="mt-3 grid gap-1.5">
              {lines.map((width, n) => (
                <div key={n} className="h-1 rounded-full bg-[#d3d2cc]" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-go-400" aria-hidden />
            <div>
              <p className="text-small font-semibold">{t(title)}</p>
              <p className="text-[0.75rem] text-ink-muted">{t(note)}</p>
            </div>
          </div>
        </motion.li>
      ))}
    </ul>
  )
}
