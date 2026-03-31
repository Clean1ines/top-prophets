export type HitRecord = {
  id: string
  timestamp: number
  earnedPoints: number
}

export type UserProfile = {
  username: string
  score: number
  lastHits: HitRecord[]
}

