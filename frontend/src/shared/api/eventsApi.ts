import { http } from './httpClient'

export type LatestEvent = {
  id: string
  eventType: string
  actualTimeSeconds: number
  createdAt: string
}

export async function fetchLatestEvents(matchId: string, limit: number = 10) {
  const { data } = await http.get<{ events: LatestEvent[] }>('/api/events/latest', {
    params: { matchId, limit },
  })
  return data.events
}

