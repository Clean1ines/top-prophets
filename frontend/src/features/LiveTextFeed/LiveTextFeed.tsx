import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

type LiveTextFeedProps = {
  messages: string[]
  /** ms between message start animations */
  messageStaggerMs?: number
  /** ms per character for typing effect */
  charDelayMs?: number
  /** Maximum number of visible messages (older ones will fade out). */
  maxVisibleMessages?: number
}

export default function LiveTextFeed({
  messages,
  messageStaggerMs = 900,
  charDelayMs = 18,
  maxVisibleMessages = 4,
}: LiveTextFeedProps) {
  const normalized = useMemo(() => messages.filter(Boolean), [messages])

  const [activeIndex, setActiveIndex] = useState(0)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (normalized.length === 0) return
    if (activeIndex >= normalized.length) return

    const msg = normalized[activeIndex] ?? ''
    setTyped('')

    let char = 0
    const interval = window.setInterval(() => {
      char += 1
      setTyped(msg.slice(0, char))
    }, charDelayMs)

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval)
      setActiveIndex((i) => i + 1)
    }, msg.length * charDelayMs + messageStaggerMs)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [activeIndex, charDelayMs, messageStaggerMs, normalized])

  const startCompleted = Math.max(0, activeIndex - maxVisibleMessages)
  const visibleMessages = normalized
    .slice(startCompleted, activeIndex)
    .map((m, i) => ({ key: `${startCompleted + i}`, text: m }))
    .concat(activeIndex < normalized.length ? [{ key: 'typing', text: typed }] : [])

  return (
    <div className="space-y-2 text-sm text-white/80">
      <AnimatePresence initial={false}>
        {visibleMessages.map((m) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {m.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

