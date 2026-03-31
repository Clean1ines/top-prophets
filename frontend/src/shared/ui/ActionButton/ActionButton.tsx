import { cn } from '../../lib/cn'

export default function ActionButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center',
        'h-12 px-6 rounded',
        'bg-[#d97706] hover:bg-[#b45309]',
        'text-black font-semibold uppercase tracking-wide',
        'transition-all hover:scale-[1.02] active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}