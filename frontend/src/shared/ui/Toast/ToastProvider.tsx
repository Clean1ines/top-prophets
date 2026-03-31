import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'

type Toast = {
  id: number
  title: string
  description?: string
  type?: 'success' | 'error' | 'info'
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
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id))
      }, 3000)
      return next
    })
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[100] flex items-end justify-center p-4 pb-28">
        <div className="flex flex-col-reverse gap-2">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(
                  'pointer-events-auto min-w-[280px] rounded bg-[#1a1a1a] border shadow-2xl px-4 py-3 flex items-center gap-3',
                  toast.type === 'error' ? 'border-[#ef4444]/40' : 'border-[#d97706]/40'
                )}
              >
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded font-black text-xl',
                  toast.type === 'error' ? 'bg-[#ef4444] text-white' : 'bg-[#d97706] text-black'
                )}>
                  {toast.type === 'error' ? '!' : '✓'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm tracking-tight uppercase text-white">{toast.title}</div>
                  {toast.description ? (
                    <div className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-[#7a7a7a]">
                      {toast.description}
                    </div>
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

