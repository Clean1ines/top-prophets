export type MatchType = 'twitch' | 'youtube' | 'text' | 'resolved'

export type TimelineEvent = {
  minute: number
  type: string
}

export type Match = {
  id: string
  title: string
  type: MatchType
  streamUrl?: string | null
  status?: 'upcoming' | 'live'
  startTimeUnix?: number
  category?: string
  sport?: string
  timeline?: TimelineEvent[]
}
