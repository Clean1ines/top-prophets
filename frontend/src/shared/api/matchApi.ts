import type { Match } from '../../entities/match/model/match'
import { http } from './httpClient'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1'

export type MatchesResponse = {
  matches: Match[]
}

export type PredictRequest = {
  matchId: string
  eventType: string
  predictedTimeSeconds: number
  username?: string
}

export type PredictResponse = {
  ok: true
  predictionId: string
}

export async function fetchMatches(category?: string) {
  const { data } = await http.get<MatchesResponse>('/api/matches', {
    params: category ? { category } : {}
  })
  return data
}

export async function fetchMatchesByCategory(category: 'dota2' | 'football') {
  if (DEMO_MODE) {
    // ИСПРАВЛЕНО: Теперь категория прокидывается и в демо-режиме
    const { data } = await http.get<MatchesResponse>('/api/matches', { 
      params: { category } 
    })
    return data
  }
  const { data } = await http.get<MatchesResponse>('/api/matches', { params: { category } })
  return data
}

export async function predictMatch(payload: PredictRequest) {
  const { data } = await http.post<PredictResponse>('/api/predict', payload)
  return data
}

export async function resolveStream(matchId: string) {
  if (DEMO_MODE) {
    // В демо-режиме запрашиваем эндпоинт, который мы поправили на бэкенде
    const { data } = await http.post<{ ok: boolean; matchId: string; streamUrl: string | null }>(
      '/api/stream/resolve',
      null,
      { params: { matchId } }
    )
    return data
  }
  const { data } = await http.post<{ ok: boolean; matchId: string; streamUrl: string | null }>(
    '/api/stream/resolve',
    null,
    {
      params: { matchId },
    },
  )
  return data
}