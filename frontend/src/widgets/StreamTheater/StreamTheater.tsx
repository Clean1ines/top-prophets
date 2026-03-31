import { useEffect, useMemo, useState } from 'react'
import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import LiveTextFeed from '../../features/LiveTextFeed/LiveTextFeed'
import { resolveStream } from '../../shared/api/matchApi'
import { usePlayerSync } from '../../shared/hooks/usePlayerSync'

function buildYouTubeEmbedUrlFromWatchUrl(watchUrl: string, startSeconds?: number) {
  // Accept: https://www.youtube.com/watch?v=VIDEOID
  const match = watchUrl.match(/[?&]v=([^&#]+)/)
  const videoId = match?.[1]
  if (!videoId) return null
  let url = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&controls=0&disablekb=1`
  if (startSeconds !== undefined && startSeconds > 0) {
    url += `&start=${startSeconds}`
  }
  return url
}

function buildYouTubeEmbedUrlFromStreamUrl(streamUrl: string, startSeconds?: number) {
  if (streamUrl.includes('/embed/')) {
    // Ensure autoplay/mute/controls/disablekb flags
    let url = streamUrl
    if (!url.includes('autoplay=')) url += (url.includes('?') ? '&' : '?') + 'autoplay=1'
    if (!url.includes('mute=')) url += '&mute=1'
    if (!url.includes('controls=')) url += '&controls=0'
    if (!url.includes('disablekb=')) url += '&disablekb=1'
    if (startSeconds !== undefined && startSeconds > 0 && !url.includes('start=')) {
      url += `&start=${startSeconds}`
    }
    return url
  }
  if (streamUrl.includes('youtube.com/watch')) {
    return buildYouTubeEmbedUrlFromWatchUrl(streamUrl, startSeconds)
  }
  if (streamUrl.includes('youtu.be/')) {
    const match = streamUrl.match(/youtu\.be\/([^?&#]+)/)
    const videoId = match?.[1]
    if (!videoId) return null
    let url = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&controls=0&disablekb=1`
    if (startSeconds !== undefined && startSeconds > 0) {
      url += `&start=${startSeconds}`
    }
    return url
  }
  return null
}

function buildTwitchEmbedUrlFromChannelUrl(twitchUrl: string) {
  // Accept: https://www.twitch.tv/{channel}
  const channel = twitchUrl
    .replace('https://www.twitch.tv/', '')
    .replace('https://twitch.tv/', '')
    .split(/[/?#]/)[0]
    .trim()

  if (!channel) return null
  const parent = encodeURIComponent('top-prophets-panel.onrender.com')
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&muted=false`
}

export default function StreamTheater() {
  const activeMatch = useMatchStore((s) => s.getActiveMatch())
  const liveEvents = useMatchStore((s) => s.liveEvents)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)

  // Activate timeline event dispatch
  usePlayerSync()

  useEffect(() => {
    setResolvedUrl(null)
    if (!activeMatch) return
    if (activeMatch.streamUrl) return
    resolveStream(activeMatch.id)
      .then((res) => setResolvedUrl(res.streamUrl))
      .catch(() => setResolvedUrl(null))
  }, [activeMatch?.id, activeMatch?.streamUrl])

  // Compute start offset for YouTube (in seconds)
  const startOffset = useMemo(() => {
    if (!activeMatch?.startTimeUnix) return undefined
    const nowSec = Date.now() / 1000
    const offset = nowSec - activeMatch.startTimeUnix
    return offset > 0 ? Math.floor(offset) : undefined
  }, [activeMatch?.startTimeUnix])

  const embedUrl = useMemo(() => {
    if (!activeMatch) return null
    const su = activeMatch.streamUrl || resolvedUrl
    if (!su) return null
    if (su.startsWith('https://www.youtube.com/') || su.includes('youtube.com/')) {
      return buildYouTubeEmbedUrlFromStreamUrl(su, startOffset)
    }
    if (su.startsWith('https://www.twitch.tv/') || su.includes('twitch.tv/')) {
      return buildTwitchEmbedUrlFromChannelUrl(su)
    }
    return null
  }, [activeMatch?.id, activeMatch?.streamUrl, resolvedUrl, startOffset])

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

        <div className="relative aspect-video w-full bg-white/5">
          {!activeMatch ? (
            <div className="h-full w-full animate-pulse bg-white/5" />
          ) : (
            <>
              {embedUrl?.includes('player.twitch.tv') ? (
                <iframe
                  title="twitch-embed"
                  src={embedUrl}
                  allow="autoplay; fullscreen"
                  className="absolute inset-0 h-full w-full"
                />
              ) : null}
              {embedUrl?.includes('youtube.com/embed') ? (
                <iframe
                  title="youtube-embed"
                  src={embedUrl}
                  allow="autoplay; fullscreen"
                  className="absolute inset-0 h-full w-full"
                />
              ) : null}
              {!embedUrl ? (
                <div className="absolute inset-0 flex items-center justify-center text-white/70 p-4 text-center">
                  Трансляция недоступна.
                </div>
              ) : null}
            </>
          )}
          {/* Overlay to block user interaction with the player (prevents seeking) */}
          <div className="absolute inset-0 z-10 bg-transparent pointer-events-auto" />
        </div>
      </GlassCard>

      <GlassCard>
        <Typography variant="small" className="mb-2 text-white/65">
          Live-чат / поддержка
        </Typography>
        {activeMatch ? (
          <LiveTextFeed messages={liveEvents} />
        ) : (
          <div className="h-24 animate-pulse bg-white/5 rounded-2xl" />
        )}
      </GlassCard>
    </div>
  )
}
