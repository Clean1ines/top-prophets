import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type TypographyProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  as?: keyof JSX.IntrinsicElements
  variant?: 'h1' | 'h2' | 'body' | 'small'
  className?: string
}

export default function Typography({
  as = 'p',
  variant = 'body',
  className,
  children,
  ...rest
}: TypographyProps) {
  const variantClass =
    variant === 'h1'
      ? 'text-3xl md:text-4xl font-bold tracking-tight text-white'
      : variant === 'h2'
        ? 'text-xl md:text-2xl font-bold tracking-tight text-white'
        : variant === 'small'
          ? 'text-xs text-[#7a7a7a] uppercase tracking-wider'
          : 'text-sm text-[#cfcfcf]'

  const Component = as as any

  return (
    <Component className={cn(variantClass, className)} {...rest}>
      {children}
    </Component>
  )
}

