import type { FormEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import { useUserStore } from '../../entities/user/store/useUserStore'
import { predictMatch } from '../../shared/api/matchApi'

function sanitizeDigits(value: string) {
  return value.replace(/[^\d]/g, '')
}

export default function PredictMomentum() {
  const activeMatch = useMatchStore((s) => s.getActiveMatch())
  const username = useUserStore((s) => s.profile.username)
  const setUsername = useUserStore((s) => s.setUsername)

  const isFootball = activeMatch?.sport === 'football' || activeMatch?.category === 'football'

  const [eventTypeFootball, setEventTypeFootball] = useState('Goal')
  const [eventTypeDota, setEventTypeDota] = useState('First Blood')
  const eventType = isFootball ? eventTypeFootball : eventTypeDota

  const [minutes, setMinutes] = useState('37')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackPositive, setFeedbackPositive] = useState(false)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Inline nickname editing
  const [editingNick, setEditingNick] = useState(false)
  const [nickDraft, setNickDraft] = useState('')

  const canSubmit = useMemo(
    () => Boolean(activeMatch && !pending && minutes !== ''),
    [activeMatch, pending, minutes]
  )

  const showFeedback = (msg: string, positive: boolean) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback(msg)
    setFeedbackPositive(positive)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1400)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeMatch || !canSubmit) return

    const mm = Math.max(0, Number(sanitizeDigits(minutes)) || 0)
    setPending(true)
    try {
      const res = await predictMatch({
        matchId: activeMatch.id,
        eventType,
        predictedMinute: mm,
        username,
      })
      useUserStore.setState((s) => ({
        profile: { ...s.profile, score: res.score },
      }))
      if (res.success) {
        showFeedback('+5', true)
      } else {
        showFeedback('+0', false)
      }
    } catch {
      showFeedback('err', false)
    } finally {
      setPending(false)
    }
  }

  const commitNick = () => {
    const n = nickDraft.trim()
    if (n && n.length > 0) setUsername(n)
    setEditingNick(false)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-0 border-t border-white/10 bg-black"
    >
      {/* Main control row */}
      <div className="flex items-center gap-2 px-4 py-2 h-12">
        {/* Event type select */}
        {isFootball ? (
          <select
            value={eventTypeFootball}
            onChange={(e) => setEventTypeFootball(e.target.value)}
            className="h-8 rounded px-2 text-sm bg-white/5 border border-white/10 text-white outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="Goal">Goal</option>
          </select>
        ) : (
          <select
            value={eventTypeDota}
            onChange={(e) => setEventTypeDota(e.target.value)}
            className="h-8 rounded px-2 text-sm bg-white/5 border border-white/10 text-white outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="First Blood">First Blood</option>
            <option value="Roshan Kill">Roshan Kill</option>
            <option value="Game End">Game End</option>
          </select>
        )}

        {/* Minute input */}
        <input
          type="number"
          min={0}
          max={120}
          value={minutes}
          onChange={(e) => setMinutes(sanitizeDigits(e.target.value))}
          className="h-8 w-16 rounded px-2 text-sm bg-white/5 border border-white/10 text-white outline-none focus:border-white/30 text-center"
          placeholder="Min"
        />

        {/* Predict button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-8 px-4 rounded text-sm font-semibold bg-white text-black hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {pending ? '·' : 'Predict'}
        </button>

        {/* Inline feedback – fixed width slot to avoid layout shift */}
        <div className="w-10 flex items-center">
          {feedback && (
            <span
              className={`text-sm font-bold animate-fade ${feedbackPositive ? 'text-green-400' : 'text-white/40'}`}
              style={{ animation: 'fadeInOut 1.4s ease forwards' }}
            >
              {feedback}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Nickname – secondary, inline editable */}
        {editingNick ? (
          <input
            autoFocus
            value={nickDraft}
            onChange={(e) => setNickDraft(e.target.value.slice(0, 24))}
            onBlur={commitNick}
            onKeyDown={(e) => { if (e.key === 'Enter') commitNick() }}
            className="h-8 w-32 rounded px-2 text-xs bg-white/5 border border-white/20 text-white outline-none"
            placeholder="nickname"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setNickDraft(username); setEditingNick(true) }}
            className="text-xs text-white/35 hover:text-white/60 transition-colors leading-none"
            title="Edit nickname"
          >
            {username}
          </button>
        )}
      </div>
    </form>
  )
}
