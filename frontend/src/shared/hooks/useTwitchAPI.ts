export function buildTwitchEmbedUrl(channelOrVideo: string, seekSeconds?: number) {
  // For prototype we treat `channelOrVideo` as twitch channel name.
  // Example: https://player.twitch.tv/?channel=NAME&parent=your-domain
  const parent = encodeURIComponent(window.location.hostname)
  const timeParam =
    typeof seekSeconds === 'number' && Number.isFinite(seekSeconds)
      ? `&time=${Math.max(0, Math.floor(seekSeconds))}`
      : ''
  return `https://player.twitch.tv/?channel=${encodeURIComponent(
    channelOrVideo,
  )}&parent=${parent}&autoplay=false&controls=false${timeParam}`
}

