import { createContext, useContext } from 'react'

export type Show = (message: string, ok?: boolean) => void

export const ToastContext = createContext<Show>(() => {})

/** Shows a short message in the bottom-right corner after a button ("Marked as applied.") */
export function useToast(): Show {
  return useContext(ToastContext)
}
