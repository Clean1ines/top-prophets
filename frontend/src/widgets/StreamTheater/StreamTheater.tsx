import { useMemo } from 'react'
import { useMatchStore } from '../../entities/match/store/useMatchStore'

export default function StreamTheater() {
  const activeMatch = useMatchStore((s) => s.getActiveMatch())

  const embedUrl = useMemo(() => {
    if (!activeMatch) return null
    return activeMatch.streamUrl ?? null
  }, [activeMatch])

  return (
    <div className="relative w-full bg-black border-b border-[#1f1f1f]" style={{ aspectRatio: '16/9' }}>
      {/* Video / placeholder */}
      {!activeMatch ? (
        <div className="absolute inset-0 animate-pulse bg-[#121212]" />
      ) : embedUrl ? (
        <iframe
          title="stream-embed"
          src={embedUrl}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
          style={{ border: 'none' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[#7a7a7a] text-sm">
          Stream unavailable
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Match info bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4 py-3 pointer-events-none">
        <span className="text-sm font-medium text-white truncate">
          {activeMatch ? activeMatch.title : '—'}
        </span>
        {activeMatch && (
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-400 tracking-wide">LIVE</span>
          </span>
        )}
      </div>
    </div>
  )
}
