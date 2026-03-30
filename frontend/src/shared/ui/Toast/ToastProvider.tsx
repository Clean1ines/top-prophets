import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'

type Toast = {
  id: number
  title: string
  description?: string
}

type ToastContextValue = {
  showToast: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    setToasts((prev) => {
      const id = Date.now()
      const next = [...prev, { ...toast, id }]
      // автоудаление
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id))
      }, 2600)
      return next
    })
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -16, x: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, x: 20, scale: 0.96 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className={cn(
                  'pointer-events-auto w-72 sm:w-80 rounded-3xl border border-white/15 bg-white/[0.06] backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.55)]',
                  'px-4 py-3 flex items-start gap-3 text-sm text-white',
                )}
              >
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
                  <span className="text-lg">⚡</span>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">{toast.title}</div>
                  {toast.description ? (
                    <div className="mt-0.5 text-xs text-white/75">{toast.description}</div>
                  ) : null}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

