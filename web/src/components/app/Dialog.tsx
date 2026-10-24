import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

/** A centered pop-up (Add job, Run search). Esc or the X closes it. */
export function Dialog({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-charcoal-950/70 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog" aria-modal aria-labelledby="dialog-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-[36rem] overflow-y-auto rounded-xl bg-charcoal-850 p-7 shadow-depth-3 ring-1 ring-hairline"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="dialog-title" className="font-wide text-title font-semibold">{title}</h2>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('Close')}><X /></Button>
            </div>
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
