import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'
import ActionButton from '../../shared/ui/ActionButton/ActionButton'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import type { Match } from '../../entities/match/model/match'
import { useEffect, useState } from 'react'
import { fetchMatchesByCategory } from '../../shared/api/matchApi'

function MatchTypeBadge({ match }: { match: Match }) {
  const label =
    match.type === 'twitch'
      ? 'Twitch'
      : match.type === 'youtube'
        ? 'YouTube'
        : match.type === 'resolved'
          ? 'Auto'
        : 'Text'
  return (
    <span
      className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/75"
      title={match.type}
    >
      {label}
    </span>
  )
}

export default function MatchDashboard() {
  const matches = useMatchStore((s) => s.matches)
  const activeMatchId = useMatchStore((s) => s.activeMatchId)
  
  const [tab, setTab] = useState<'dota2' | 'football'>('football')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetchMatchesByCategory(tab)
        if (cancelled) return
        
        useMatchStore.setState((s) => {
          let nextActiveId = s.activeMatchId
          // If we don't have an active match for this tab, or the active match isn't in this list, pick the first one
          if (res.matches.length > 0) {
              const stillActive = nextActiveId && res.matches.some((m) => m.id === nextActiveId)
              if (!stillActive) {
                  nextActiveId = res.matches[0].id
              }
          } else {
              nextActiveId = null
          }
          return { matches: res.matches, activeMatchId: nextActiveId }
        })

      } catch (err) {
        if (!cancelled) {
          console.error("Dashboard load error:", err)
          useMatchStore.setState({ matches: [], activeMatchId: null })
        }
      }
    }

    load()
  }, [tab])

  function formatHMS(totalSeconds: number) {
    const safe = Math.max(0, Math.floor(totalSeconds))
    const h = Math.floor(safe / 3600)
    const m = Math.floor((safe % 3600) / 60)
    const s = safe % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!matches || matches.length === 0) {
    // Only fetch once logic handles missing data
    return null
  }

  return (
    <GlassCard>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Typography variant="small" className="text-white/65">
            Доступные трансляции
          </Typography>
          <Typography as="h2" variant="h2" className="text-lg md:text-xl">
            {matches.length}
          </Typography>
        </div>
        <div className="hidden sm:block text-white/50 text-sm">Выбери матч</div>
      </div>

      <div className="mt-3 flex gap-2">
        <ActionButton
          className={tab === 'football' ? 'bg-white/20 border-white/30' : 'bg-white/5 hover:bg-white/10'}
          onClick={() => setTab('football')}
        >
          Football
        </ActionButton>
        <ActionButton
          className={tab === 'dota2' ? 'bg-white/20 border-white/30' : 'bg-white/5 hover:bg-white/10'}
          onClick={() => setTab('dota2')}
        >
          Dota 2
        </ActionButton>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {matches.map((m) => {
          const active = m.id === activeMatchId
          const secondsLeft = m.startTimeUnix ? Math.floor(m.startTimeUnix - now / 1000) : null
          return (
            <div
              key={m.id}
              className={
                active
                  ? 'rounded-3xl border border-accent-gold/40 bg-white/[0.06] backdrop-blur-xl p-3 shadow-[0_0_30px_rgba(252,211,77,0.35)] transition-all duration-250'
                  : 'rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-3 shadow-[0_18px_40px_rgba(0,0,0,0.65)] hover:shadow-[0_0_28px_rgba(255,255,255,0.18)] hover:bg-white/[0.05] transition-all duration-250'
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {secondsLeft !== null && secondsLeft <= 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-2xl bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                        <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                        LIVE
                      </span>
                    ) : null}
                    <div className="truncate font-semibold">{m.title}</div>
                  </div>
                  <div className="mt-1">
                    <MatchTypeBadge match={m} />
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {secondsLeft === null
                      ? 'В эфире'
                      : secondsLeft <= 0
                        ? 'В эфире'
                        : formatHMS(secondsLeft)}
                  </div>
                </div>
                <ActionButton
                  className="min-w-[92px] bg-white/5 hover:bg-white/10"
                  onClick={() => useMatchStore.setState({ activeMatchId: m.id })}
                  disabled={active}
                >
                  {active ? 'Актив' : 'Открыть'}
                </ActionButton>
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}