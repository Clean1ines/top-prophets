import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type GlassCardProps = {
  children: ReactNode
  className?: string
}

/** Stripped-down card: optional thin border, no blur, no heavy shadow. */
export default function GlassCard({ children, className }: GlassCardProps) {
  return (
    <section
      className={cn(
        'border border-white/[0.08] bg-transparent',
        'p-4',
        className,
      )}
    >
      {children}
    </section>
  )
}
