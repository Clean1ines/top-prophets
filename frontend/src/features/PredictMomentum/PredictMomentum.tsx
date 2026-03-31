import type { FormEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
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
  const addSuccessfulPrediction = useUserStore((s) => s.addSuccessfulPrediction)

  const isFootball = activeMatch?.sport === 'football' || activeMatch?.category === 'football'

  const [eventTypeFootball, setEventTypeFootball] = useState('Goal')
  const [eventTypeDota, setEventTypeDota] = useState('First Blood')
  const eventType = isFootball ? eventTypeFootball : eventTypeDota

  const [minutes, setMinutes] = useState('37')
  const [pending, setPending] = useState(false)
  const { showToast } = useToast()

  // Inline nickname editing
  const [editingNick, setEditingNick] = useState(false)
  const [nickDraft, setNickDraft] = useState('')

  const canSubmit = useMemo(
    () => Boolean(activeMatch && !pending && minutes !== ''),
    [activeMatch, pending, minutes]
  )


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
        addSuccessfulPrediction({ matchId: activeMatch.id, eventType, minute: mm })
        showToast({ 
          title: 'Prediction Confirmed', 
          description: `+5 POINTS: ${eventType} @ ${mm}'`, 
          type: 'success' 
        })
      } else {
        showToast({ 
          title: 'Prediction Failed', 
          description: 'INCORRECT GUESS (0 POINTS)', 
          type: 'error' 
        })
      }
    } catch {
      showToast({ 
        title: 'System Error', 
        description: 'Connection failed. Please retry.', 
        type: 'error' 
      })
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
    <div className="border-t border-[#1f1f1f] bg-[#121212] px-4 py-5">
      <form onSubmit={onSubmit} className="flex flex-col">
        <div className="flex items-center gap-3">
          {/* Event selector */}
          <div className="relative">
            {isFootball ? (
              <select
                value={eventTypeFootball}
                onChange={(e) => setEventTypeFootball(e.target.value)}
                className="h-12 px-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded text-[#cfcfcf] text-sm focus:outline-none focus:border-[#d97706] cursor-pointer transition-colors"
              >
                <option value="Goal">Goal</option>
              </select>
            ) : (
              <select
                value={eventTypeDota}
                onChange={(e) => setEventTypeDota(e.target.value)}
                className="h-12 px-4 bg-[#0b0b0b] border border-[#1f1f1f] rounded text-[#cfcfcf] text-sm focus:outline-none focus:border-[#d97706] cursor-pointer transition-colors"
              >
                <option value="First Blood">First Blood</option>
                <option value="Roshan Kill">Roshan Kill</option>
                <option value="Game End">Game End</option>
              </select>
            )}
          </div>

          {/* Minute input */}
          <input
            type="number"
            min={0}
            max={120}
            value={minutes}
            onChange={(e) => setMinutes(sanitizeDigits(e.target.value))}
            className="h-12 w-20 px-3 bg-[#0b0b0b] border border-[#1f1f1f] rounded text-white text-center text-lg font-semibold focus:outline-none focus:border-[#d97706] transition-colors"
            placeholder="Min"
          />

          {/* Big Predict button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 px-8 bg-[#d97706] hover:bg-[#b45309] text-black font-bold rounded tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed uppercase"
          >
            {pending ? '···' : 'Predict'}
          </button>
        </div>

        {/* User context layer */}
        <div className="mt-3 flex items-center gap-2 text-xs text-[#7a7a7a]">
          <span>Predicting as</span>
          {editingNick ? (
            <input
              autoFocus
              value={nickDraft}
              onChange={(e) => setNickDraft(e.target.value.slice(0, 24))}
              onBlur={commitNick}
              onKeyDown={(e) => { if (e.key === 'Enter') commitNick() }}
              className="bg-[#0b0b0b] border-b border-[#d97706]/40 text-[#cfcfcf] outline-none px-1"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setNickDraft(username); setEditingNick(true) }}
              className="text-[#cfcfcf] hover:text-white transition-colors flex items-center gap-1 group"
            >
              <span className="font-medium underline decoration-[#1f1f1f] underline-offset-4 group-hover:decoration-[#d97706]/40">{username}</span>
              <span className="text-[#1f1f1f] group-hover:text-[#d97706] transition-colors">✎</span>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
