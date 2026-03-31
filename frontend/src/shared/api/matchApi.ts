import type { Match } from '../../entities/match/model/match'
import { http } from './httpClient'

export type MatchesResponse = {
  matches: Match[]
}

export type PredictRequest = {
  matchId: string
  eventType: string
  predictedMinute: number
  username?: string
}

export type PredictResponse = {
  success: boolean
  message: string
  score: number
}

// category can be 'dota2' or 'football'
// Let's filter matches for the exact category on the client since the backend returns all demo matches.
export async function fetchMatchesByCategory(category: 'dota2' | 'football') {
  const { data } = await http.get<MatchesResponse>('/api/matches')
  return {
    ...data,
    matches: data.matches.filter(m => m.sport === category || m.category === category)
  }
}

export async function predictMatch(payload: PredictRequest) {
  const { data } = await http.post<PredictResponse>('/api/predict', payload)
  return data
}