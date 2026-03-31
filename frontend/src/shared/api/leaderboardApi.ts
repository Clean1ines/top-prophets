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
