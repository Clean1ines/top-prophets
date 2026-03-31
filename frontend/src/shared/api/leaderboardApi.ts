import { http } from './httpClient'

export type LeaderboardEntry = {
  id: string
  username: string
  score: number
}

export async function fetchLeaderboard() {
  const { data } = await http.get<{ entries: LeaderboardEntry[] }>('/api/leaderboard')
  return data.entries
}

export async function addScore(username: string) {
  const { data } = await http.post<{ ok: boolean; username: string; newScore: number }>('/api/score/add', { username })
  return data
}
