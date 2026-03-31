import { useEffect, useState } from 'react'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import { fetchMatchesByCategory } from '../../shared/api/matchApi'
import { fetchLeaderboard, type LeaderboardEntry } from '../../shared/api/leaderboardApi'
import { useUserStore } from '../../entities/user/store/useUserStore'
import type { TimelineEvent } from '../../entities/match/model/match'

type Props = {
  mobileTab?: 'events' | 'leaderboard'
}

export default function MatchDashboard({ mobileTab }: Props) {
  const matches = useMatchStore((s) => s.matches)
  const activeMatchId = useMatchStore((s) => s.activeMatchId)
  const activeMatch = useMatchStore((s) => s.getActiveMatch())
  const currentUsername = useUserStore((s) => s.profile.username)

  const [sport, setSport] = useState<'football' | 'dota2'>('football')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // Load matches when sport tab changes
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetchMatchesByCategory(sport)
        if (cancelled) return
        useMatchStore.setState((s) => {
          const stillActive =
            s.activeMatchId && res.matches.some((m) => m.id === s.activeMatchId)
          return {
            matches: res.matches,
            activeMatchId: res.matches.length
              ? stillActive
                ? s.activeMatchId
                : res.matches[0].id
              : null,
          }
        })
      } catch {
        useMatchStore.setState({ matches: [], activeMatchId: null })
      }
    }
    load()
    return () => { cancelled = true }
  }, [sport])

  // Poll leaderboard
  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        const entries = await fetchLeaderboard()
        if (mounted) setLeaderboard(entries)
      } catch { /* best-effort */ }
    }
    tick()
    const t = window.setInterval(tick, 4500)
    return () => { mounted = false; window.clearInterval(t) }
  }, [])

  const timeline: TimelineEvent[] = activeMatch?.timeline ?? []

  // On desktop mobileTab is undefined → show everything
  // On mobile, show based on mobileTab
  const showEvents = mobileTab === undefined || mobileTab === 'events'
  const showLeaderboard = mobileTab === undefined || mobileTab === 'leaderboard'

  return (
    <div className="flex flex-col">

      {/* ── Sport toggle ── */}
      {showEvents && (
        <div className="flex items-center gap-0 px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => setSport('football')}
            className={
              sport === 'football'
                ? 'px-3 py-1 text-sm font-semibold text-white border-b-2 border-white mr-2'
                : 'px-3 py-1 text-sm text-white/40 hover:text-white/70 transition-colors mr-2'
            }
          >
            Football
          </button>
          <button
            type="button"
            onClick={() => setSport('dota2')}
            className={
              sport === 'dota2'
                ? 'px-3 py-1 text-sm font-semibold text-white border-b-2 border-white'
                : 'px-3 py-1 text-sm text-white/40 hover:text-white/70 transition-colors'
            }
          >
            Dota 2
          </button>
        </div>
      )}

      {/* ── Match selector (compact list) ── */}
      {showEvents && (
        <div className="px-4 pb-2">
          {matches.length === 0 ? (
            <p className="text-xs text-white/30 py-2">No matches available</p>
          ) : (
            <div className="flex flex-col">
              {matches.map((m) => {
                const active = m.id === activeMatchId
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => useMatchStore.setState({ activeMatchId: m.id })}
                    className={[
                      'flex items-center justify-between gap-2 py-2 text-left text-sm',
                      'border-t border-white/[0.06] first:border-t-0',
                      active ? 'text-white' : 'text-white/50 hover:text-white/80 transition-colors',
                    ].join(' ')}
                  >
                    <span className="truncate">{m.title}</span>
                    {active && (
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] text-red-400 font-semibold tracking-wide">LIVE</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Timeline divider ── */}
      {showEvents && (
        <>
          <div className="border-t border-white/10 mx-4" />

          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Timeline</p>
          </div>

          {/* Timeline events */}
          <div className="px-4 pb-2">
            {timeline.length === 0 ? (
              <p className="text-xs text-white/25 py-2 italic">No events yet</p>
            ) : (
              <div className="flex flex-col">
                {[...timeline]
                  .sort((a, b) => a.minute - b.minute)
                  .map((ev, i, arr) => {
                    const isLast = i === arr.length - 1
                    return (
                      <div
                        key={`${ev.minute}-${ev.type}-${i}`}
                        className={[
                          'flex items-center gap-3 py-1.5 text-sm',
                          'border-t border-white/[0.06] first:border-t-0',
                          isLast ? 'text-white font-semibold' : 'text-white/55',
                        ].join(' ')}
                      >
                        <span className="w-8 text-right text-xs text-white/30 shrink-0">
                          {ev.minute}'
                        </span>
                        {isLast && (
                          <span className="text-white/40 text-xs">›</span>
                        )}
                        <span className="truncate">{ev.type}</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Leaderboard ── */}
      {showLeaderboard && (
        <>
          <div className="border-t border-white/10 mx-4 mt-1" />

          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">Leaderboard</p>
          </div>

          <div className="px-4 pb-4">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-white/25 italic py-1">Be the first to score!</p>
            ) : (
              <div className="flex flex-col">
                {leaderboard.slice(0, 8).map((e, idx) => (
                  <div
                    key={e.id}
                    className={[
                      'flex items-center gap-2 py-1.5 text-sm',
                      'border-t border-white/[0.06] first:border-t-0',
                      e.username === currentUsername ? 'text-white font-semibold' : 'text-white/55',
                    ].join(' ')}
                  >
                    <span className="w-5 text-right text-xs text-white/25 shrink-0">{idx + 1}</span>
                    <span className="flex-1 truncate">{e.username}</span>
                    <span className="text-xs text-white/70">{e.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}