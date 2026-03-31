import { useMemo } from 'react'
import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'
import { useMatchStore } from '../../entities/match/store/useMatchStore'

export default function StreamTheater() {
  const activeMatch = useMatchStore((s) => s.getActiveMatch())

  const embedUrl = useMemo(() => {
    if (!activeMatch) return null
    return activeMatch.streamUrl
  }, [activeMatch])

  return (
    <div className="space-y-4">
      <GlassCard className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Typography as="h2" variant="h2" className="text-accent-gold">
              {activeMatch ? activeMatch.title : 'Загрузка эфира...'}
            </Typography>
            {activeMatch ? (
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-1">
                <span className="h-2.5 w-2.5 rounded-2xl bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold text-red-300 tracking-wide">LIVE</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative w-full bg-black flex aspect-video">
          {!activeMatch ? (
            <div className="h-full w-full animate-pulse bg-white/5" />
          ) : (
            <>
              {embedUrl ? (
                <iframe
                  title="youtube-embed"
                  src={embedUrl}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                  style={{ border: 'none' }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/70 p-4 text-center">
                  Трансляция недоступна.
                </div>
              )}
            </>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
