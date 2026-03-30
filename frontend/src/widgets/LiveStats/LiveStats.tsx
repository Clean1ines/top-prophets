import { useEffect, useMemo, useState } from 'react'
import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import { fetchLeaderboard, type LeaderboardEntry } from '../../shared/api/leaderboardApi'
import { fetchLatestEvents, type LatestEvent } from '../../shared/api/eventsApi'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${pad2(mm)}:${pad2(ss)}`
}

export default function LiveStats() {
  const activeMatch = useMatchStore((s) => s.getActiveMatch())
  const activeMatchId = activeMatch?.id ?? null

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [events, setEvents] = useState<LatestEvent[]>([])

  const refreshAll = useMemo(() => {
    return async () => {
      try {
        const entries = await fetchLeaderboard()
        setLeaderboard(entries)
      } catch {
        // best-effort
      }

      if (!activeMatchId) return
      try {
        const latest = await fetchLatestEvents(activeMatchId, 8)
        setEvents(latest)
      } catch {
        // best-effort
      }
    }
  }, [activeMatchId])

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      if (!mounted) return
      await refreshAll()
    }

    tick()
    const t = window.setInterval(() => tick(), 4500)
    return () => {
      mounted = false
      window.clearInterval(t)
    }
  }, [refreshAll])

  return (
    <GlassCard>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Typography variant="small" className="text-white/65">
              Live-статистика
            </Typography>
            <Typography as="h2" variant="h2" className="text-lg md:text-xl">
              {activeMatch ? activeMatch.title : '—'}
            </Typography>
          </div>
          <div className="text-sm text-white/70 text-right">События подтягиваются автоматически</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <Typography variant="small" className="text-white/65">Последние события</Typography>
          <div className="mt-2 space-y-2 text-sm">
            {events.length ? (
              events.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{e.eventType}</div>
                    <div className="text-white/60 text-xs">Actual: {formatMMSS(e.actualTimeSeconds)}</div>
                  </div>
                  <div className="text-white/50 text-xs whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-24 animate-pulse bg-white/5 rounded-2xl" />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <Typography variant="small" className="text-white/65">
            Рейтинг (глобальный)
          </Typography>
          <div className="mt-2 space-y-1 text-sm">
            {leaderboard.slice(0, 6).map((e, idx) => (
              <div key={e.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 text-right text-white/50">{idx + 1}</div>
                  <div className="truncate">{e.username}</div>
                </div>
                <div className="text-white/90 font-semibold">+{e.score}</div>
              </div>
            ))}
            {leaderboard.length === 0 ? <div className="h-20 animate-pulse bg-white/5 rounded-2xl" /> : null}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

