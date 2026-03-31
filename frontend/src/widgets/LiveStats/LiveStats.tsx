import { useEffect, useState } from 'react'
import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import { fetchLeaderboard, type LeaderboardEntry } from '../../shared/api/leaderboardApi'
import { useUserStore } from '../../entities/user/store/useUserStore'

export default function LiveStats() {
  const activeMatch = useMatchStore((s) => s.getActiveMatch())
  const currentUsername = useUserStore((s) => s.profile.username)

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const entries = await fetchLeaderboard()
        if (!mounted) return
        setLeaderboard(entries)
      } catch {
        // best-effort
      }
    }

    tick()
    const t = window.setInterval(tick, 2000)
    return () => {
      mounted = false
      window.clearInterval(t)
    }
  }, [])

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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <Typography variant="small" className="text-white/65">События матча (для проверки)</Typography>
          <div className="mt-3 space-y-3 text-sm max-h-64 overflow-y-auto pr-2">
            {activeMatch?.timeline ? (
              (activeMatch.timeline as any[]).map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white/5 rounded-lg p-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{e.type}</div>
                  </div>
                  <div className="text-accent-gold text-xs whitespace-nowrap font-bold">
                    {e.minute} мин
                  </div>
                </div>
              ))
            ) : (
              <div className="text-white/40 text-xs italic">Событий нет</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <Typography variant="small" className="text-accent-gold font-bold uppercase tracking-wider">
            Global Rankings (Eternal)
          </Typography>
          <div className="mt-3 space-y-2 text-sm">
            {leaderboard.slice(0, 6).map((e, idx) => (
              <div
                key={e.id}
                className={`flex items-center justify-between gap-3 ${
                  e.username === currentUsername ? 'bg-white/10 rounded-lg px-2 py-1 -mx-2' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 text-right text-white/50">{idx + 1}</div>
                  <div className="truncate">{e.username}</div>
                </div>
                <div className="text-white/90 font-semibold">{e.score} pts</div>
              </div>
            ))}
            {leaderboard.length === 0 ? <div className="text-white/40 text-xs mt-2 italic">Пока никто не заработал очки. Будь первым!</div> : null}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
