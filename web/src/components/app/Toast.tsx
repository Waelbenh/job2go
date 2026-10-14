import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ToastContext, type Show } from './toast-context'

interface Toast { id: number; ok: boolean; message: string }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(0)
  const show = useCallback<Show>((message, ok = true) => {
    const id = next.current++
    setToasts((all) => [...all.slice(-2), { id, ok, message }])
    // problems stay a bit longer, so there is time to read them
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), ok ? 4500 : 9000)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-6 bottom-6 z-[60] grid w-[min(26rem,calc(100vw-2rem))] gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.p
              key={t.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="glass flex items-start gap-2.5 rounded-md px-4 py-3 text-small"
            >
              {t.ok
                ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-go-400" aria-hidden />
                : <CircleAlert className="mt-0.5 size-4 shrink-0 text-score-low" aria-hidden />}
              <span className={cn(!t.ok && 'text-ink')}>{t.message}</span>
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
