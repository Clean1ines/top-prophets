export type MatchType = 'twitch' | 'youtube' | 'text' | 'resolved'

export type Match = {
  id: string
  title: string
  type: MatchType
  /** Twitch channel name (matches streamId in matches.json). */
  streamId?: string
  /** YouTube handle (matches channelHandle in matches.json). */
  channelHandle?: string
  streamUrl?: string | null
  status?: 'upcoming' | 'live'
  startTimeUnix?: number
  tournament?: string
  team1?: string
  team2?: string
  apiFixtureId?: string | null
  category?: string
}

