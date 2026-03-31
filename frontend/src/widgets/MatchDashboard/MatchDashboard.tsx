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
  const successfulPredictions = useUserStore((s) => s.successfulPredictions)

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

  // Build a Set of correctly predicted keys for the active match
  const predictedKeys = new Set(
    successfulPredictions
      .filter((p) => p.matchId === activeMatchId)
      .map((p) => `${p.eventType.toLowerCase()}:${p.minute}`)
  )

  const showEvents = mobileTab === undefined || mobileTab === 'events'
  const showLeaderboard = mobileTab === undefined || mobileTab === 'leaderboard'

  return (
    <div className="flex flex-col">

      {/* ── Sport toggle ── */}
      {showEvents && (
        <div className="px-4 pt-4 pb-3 bg-[#121212] border-b border-[#1f1f1f]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a] mb-3">
            Channels
          </p>
          <div className="flex gap-1 bg-[#0b0b0b] rounded p-1">
            {(['football', 'dota2'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                className={
                  sport === s
                    ? 'flex-1 py-1.5 text-[11px] uppercase tracking-wider font-bold text-black bg-[#d97706] rounded transition-all'
                    : 'flex-1 py-1.5 text-[11px] uppercase tracking-wider text-[#7a7a7a] hover:text-[#cfcfcf] transition-colors rounded'
                }
              >
                {s === 'football' ? 'Football' : 'Dota 2'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Match list ── */}
      {showEvents && (
        <div className="px-4 py-4 space-y-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">Active Broadcasts</p>
          {matches.length === 0 ? (
            <p className="text-xs text-[#7a7a7a] py-2">No matches available</p>
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
                      'flex items-center justify-between gap-2 py-3 px-2 -mx-2 text-left text-xs transition-colors',
                      'border-t border-[#1f1f1f] first:border-t-0',
                      active
                        ? 'text-white font-medium bg-[#1a1a1a]'
                        : 'text-[#cfcfcf] hover:bg-[#1a1a1a]',
                    ].join(' ')}
                  >
                    <span className="truncate">{m.title}</span>
                    {active && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                        <span className="text-[10px] text-[#ef4444] font-bold tracking-widest">LIVE</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Timeline ── */}
      {showEvents && (
        <div className="px-4 py-4 space-y-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
            Live Feed
          </p>
          {timeline.length === 0 ? (
            <p className="text-xs text-[#7a7a7a] py-2 italic font-mono uppercase tracking-tight">No broadcasts detected</p>
          ) : (
            <div className="flex flex-col">
              {[...timeline]
                .sort((a, b) => b.minute - a.minute) // Recent first for editorial feel
                .map((ev, i) => {
                  const key = `${ev.type.toLowerCase()}:${ev.minute}`
                  const predicted = predictedKeys.has(key)
                  return (
                    <div
                      key={`${ev.minute}-${ev.type}-${i}`}
                      className={[
                        'flex items-center gap-4 py-2.5 text-xs',
                        'border-t border-[#1f1f1f] first:border-t-0',
                        predicted ? 'text-[#d97706] font-medium' : 'text-[#cfcfcf]',
                      ].join(' ')}
                    >
                      <span className="w-8 text-right font-mono text-[#7a7a7a] shrink-0">
                        {ev.minute}'
                      </span>
                      <span className="truncate uppercase tracking-tight">{ev.type}</span>
                      {predicted && (
                        <span className="ml-auto flex items-center gap-1.5 bg-[#d97706]/10 px-2 py-0.5 rounded text-[10px] font-bold text-[#d97706]">
                          ✓ WIN
                        </span>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ── Leaderboard ── */}
      {showLeaderboard && (
        <div className="px-4 py-4 space-y-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
            Global Prophecy Feed
          </p>
          {leaderboard.length === 0 ? (
            <p className="text-xs text-[#7a7a7a] italic py-1">Be the first to score!</p>
          ) : (
            <div className="flex flex-col">
              {leaderboard.slice(0, 15).map((e, idx) => {
                const isMe = e.username === currentUsername
                return (
                  <div
                    key={e.id}
                    className={[
                      'flex items-center gap-3 py-2.5 text-xs',
                      'border-t border-[#1f1f1f] first:border-t-0',
                    ].join(' ')}
                  >
                    <span className="w-5 text-right font-mono text-[#7a7a7a] shrink-0">{idx + 1}</span>
                    <span className={`flex-1 truncate font-medium ${isMe ? 'text-[#d97706]' : 'text-white'}`}>
                      {e.username}
                    </span>
                    <span className={`font-mono font-bold ${isMe ? 'text-[#d97706]' : 'text-[#cfcfcf]'}`}>
                      {e.score}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}