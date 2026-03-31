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

  const [eventTypeFootball, setEventTypeFootball] = useState('Goal')
  const [eventTypeDota, setEventTypeDota] = useState('First Blood')
  const [minutes, setMinutes] = useState('0')

  const isFootball = activeMatch?.sport === 'football' || activeMatch?.category === 'football'
  const eventType = isFootball ? eventTypeFootball : eventTypeDota

  const canSubmit = useMemo(() => Boolean(activeMatch && !pending && minutes !== ''), [activeMatch, pending, minutes])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeMatch) return

    const isGuest = (!username || username === 'guest')
    if (isGuest) {
      setNicknameModalOpen(true)
      setPendingNickname('')
      return
    }

    const mm = Math.max(0, Number(sanitizeDigits(minutes)) || 0)

    setPending(true)
    setToast(null)
    try {
      const res = await predictMatch({
        matchId: activeMatch.id,
        eventType,
        predictedMinute: mm,
        username: username,
      })

      if (res.success) {
        useUserStore.setState((s) => ({
          profile: { ...s.profile, score: res.score }
        }))
        showToast({
          title: 'Угадал!',
          description: `+5 очков! Текущий счет: ${res.score}`,
        })
        setToast(`Точный прогноз!`)
      } else {
        useUserStore.setState((s) => ({
          profile: { ...s.profile, score: res.score }
        }))
        showToast({
          title: res.message === 'Ты уже получал очки за это событие!' ? 'Дубликат' : 'Мимо!',
          description: res.message,
        })
        setToast(res.message)
      }
      
      window.setTimeout(() => setToast(null), 1800)
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
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-accent-gold shadow-2xl z-10"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Typography as="h2" variant="h2" className="text-accent-gold">
            Предсказание
          </Typography>
          <Typography variant="small" className="text-white/70">
            Угадай точную минуту события
          </Typography>
        </div>

        <div className="space-y-2">
          <Typography variant="small" className="text-white/65">
            Событие
          </Typography>
          {isFootball ? (
              <select
                value={eventTypeFootball}
                onChange={(e) => setEventTypeFootball(e.target.value)}
                className="w-full rounded-3xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
              >
                <option value="Goal">Goal (Гол)</option>
              </select>
          ) : (
            <select
                value={eventTypeDota}
                onChange={(e) => setEventTypeDota(e.target.value)}
                className="w-full rounded-3xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
              >
                <option value="First Blood">First Blood</option>
                <option value="Roshan Kill">Убийство Рошана</option>
                <option value="Game End">Конец игры</option>
              </select>
          )}
        </div>

        <div className="space-y-2">
            <Typography variant="small" className="text-white/65">
              Минута (число)
            </Typography>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes}
              onChange={(e) => setMinutes(sanitizeDigits(e.target.value))}
              placeholder="Введите минуту (например, 15)"
              className="w-full rounded-3xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent-gold/50"
            />
        </div>

        <ActionButton
          type="submit"
          className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-accent-gold mt-2 py-3"
          disabled={!canSubmit}
        >
          {pending ? 'Проверка...' : 'Сделать прогноз'}
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
                Как тебя называть?
              </Typography>
              <Typography variant="small" className="mb-4 text-white/70">
                Введи никнейм для лидерборда.
              </Typography>
              <input
                autoFocus
                value={pendingNickname}
                onChange={(e) => setPendingNickname(e.target.value.slice(0, 24))}
                placeholder="Твой ник"
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
                    if (!name || name === 'guest') return
                    setUsername(name)
                    setNicknameModalOpen(false)
                  }}
                >
                  Подтвердить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  )
}
