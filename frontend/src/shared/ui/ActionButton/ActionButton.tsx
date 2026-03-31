import type { ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'

type ActionButtonProps = React.ComponentPropsWithoutRef<typeof motion.button>

export default function ActionButton({ className, ...props }: ActionButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl px-4 py-3 font-semibold',
        'bg-white/10 hover:bg-white/15 border border-white/15',
        'text-white focus:outline-none focus:ring-2 focus:ring-accent-gold/60',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}