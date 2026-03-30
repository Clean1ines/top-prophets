import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type GlassCardProps = {
  children: ReactNode
  className?: string
}

export default function GlassCard({ children, className }: GlassCardProps) {
  return (
    <section
      className={cn(
        'rounded-3xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] shadow-2xl',
        'p-4',
        className,
      )}
    >
      {children}
    </section>
  )
}

