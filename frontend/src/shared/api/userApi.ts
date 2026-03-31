import { http } from './httpClient'

export type UserProfileResponse = {
  username: string
  score: number
  guessed: string[]
}

export async function fetchUserProfile(username: string): Promise<UserProfileResponse> {
  const { data } = await http.get<UserProfileResponse>(`/api/user/${encodeURIComponent(username)}`)
  return data
}
