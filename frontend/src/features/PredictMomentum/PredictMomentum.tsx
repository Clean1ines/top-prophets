import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ActionButton from '../../shared/ui/ActionButton/ActionButton'
import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import { useUserStore } from '../../entities/user/store/useUserStore'
import { predictMatch } from '../../shared/api/matchApi'
import { useToast } from '../../shared/ui/Toast/ToastProvider'

type EventType = 'Goal' | 'First Blood' | 'Roshan Kill'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function sanitizeDigits(value: string) {
  return value.replace(/[^\d]/g, '')
}

export default function PredictMomentum() {
  const activeMatch = useMatchStore((s) => s.getActiveMatch())
  const username = useUserStore((s) => s.profile.username)
  const setUsername = useUserStore((s) => s.setUsername)
  const { showToast } = useToast()

  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false)
  const [pendingNickname, setPendingNickname] = useState('')

  const [eventType, setEventType] = useState<EventType>('Goal')
  const [minutes, setMinutes] = useState('0')
  const [seconds, setSeconds] = useState('0')

  const canSubmit = useMemo(() => Boolean(activeMatch && !pending), [activeMatch, pending])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeMatch) return

    const stored = window.localStorage.getItem('tp_nickname') || ''
    const isGuest = !stored && (!username || username === 'guest')
    if (isGuest) {
      setNicknameModalOpen(true)
      setPendingNickname('')
      return
    }

    const mm = Math.max(0, Number(sanitizeDigits(minutes)) || 0)
    const ssRaw = Math.max(0, Number(sanitizeDigits(seconds)) || 0)
    const ss = Math.min(59, ssRaw)
    const predictedTimeSeconds = mm * 60 + ss

    setPending(true)
    setToast(null)
    try {
      await predictMatch({
        matchId: activeMatch.id,
        eventType,
        predictedTimeSeconds,
        username,
      })

      setToast(`Прогноз зафиксирован на ${pad2(mm)}:${pad2(ss)}!`)
      window.setTimeout(() => setToast(null), 1800)
      showToast({
        title: 'Событие подтверждено ИИ!',
        description: '+500 XP начислено на твой аккаунт.',
      })
    } catch {
      setToast('Ошибка сети. Попробуй снова.')
      window.setTimeout(() => setToast(null), 1800)
    } finally {
      setPending(false)
    }
  }

  return (
    <GlassCard className="relative overflow-hidden">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: -14, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-accent-gold shadow-2xl"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form className="space-y-3" onSubmit={onSubmit}>
        <div>
          <Typography as="h2" variant="h2" className="text-accent-gold">
            Оракул времени
          </Typography>
          <Typography variant="small" className="text-white/70">
            Зафиксируй прогноз заранее
          </Typography>
        </div>

        <div className="space-y-2">
          <Typography variant="small" className="text-white/65">
            Событие
          </Typography>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="w-full rounded-3xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
          >
            <option value="Goal">Гол</option>
            <option value="First Blood">First Blood</option>
            <option value="Roshan Kill">Убийство Рошана</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Typography variant="small" className="text-white/65">
              Минуты (MM)
            </Typography>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes}
              onChange={(e) => setMinutes(sanitizeDigits(e.target.value))}
              className="w-full rounded-3xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
            />
          </div>
          <div className="space-y-2">
            <Typography variant="small" className="text-white/65">
              Секунды (SS, 0-59)
            </Typography>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={seconds}
              onChange={(e) => {
                const digits = sanitizeDigits(e.target.value)
                const num = Number(digits)
                if (!digits) return setSeconds('0')
                if (!Number.isFinite(num)) return
                setSeconds(String(Math.min(59, Math.max(0, num))))
              }}
              className="w-full rounded-3xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
            />
          </div>
        </div>

        <ActionButton
          type="submit"
          className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-accent-gold"
          disabled={!canSubmit}
        >
          {pending ? 'Фиксируем...' : 'Сделать прогноз'}
        </ActionButton>
      </form>

      <AnimatePresence>
        {nicknameModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/[0.06] backdrop-blur-xl px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.75)]"
            >
              <Typography as="h2" variant="h2" className="mb-1 text-base text-white">
                Присоединяйся к действию
              </Typography>
              <Typography variant="small" className="mb-4 text-white/70">
                Введи никнейм, под которым тебя будет видно в рейтинге.
              </Typography>
              <input
                autoFocus
                value={pendingNickname}
                onChange={(e) => setPendingNickname(e.target.value.slice(0, 24))}
                placeholder="Например, clutch_master"
                className="w-full rounded-3xl bg-white/[0.03] border border-white/15 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-accent-gold/60"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-3xl px-3 py-2 text-xs text-white/65 hover:bg-white/5"
                  onClick={() => setNicknameModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="rounded-3xl bg-white text-xs font-semibold px-4 py-2 text-black hover:bg-white/90"
                  onClick={() => {
                    const name = pendingNickname.trim()
                    if (!name) return
                    window.localStorage.setItem('tp_nickname', name)
                    setUsername(name)
                    setNicknameModalOpen(false)
                  }}
                >
                  Join Action
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  )
}

