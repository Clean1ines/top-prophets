import { create } from 'zustand'
import type { HitRecord, UserProfile } from '../model/user'
import { fetchUserProfile } from '../../../shared/api/userApi'

export type SuccessfulPrediction = {
  matchId: string
  eventType: string
  minute: number
}

type UserStore = {
  profile: UserProfile
  successfulPredictions: SuccessfulPrediction[]
  setUsername: (username: string) => Promise<void>
  applyHit: (record: Omit<HitRecord, 'timestamp'> & { timestamp?: number }) => void
  addScore: (points?: number) => void
  addSuccessfulPrediction: (p: SuccessfulPrediction) => void
}

export const useUserStore = create<UserStore>((set) => ({
  profile: {
    username: 'guest',
    score: 0,
    lastHits: [],
  },

  successfulPredictions: [],

  setUsername: async (username) => {
    // Optimistic update
    set((s) => ({
      profile: { ...s.profile, username }
    }))

    try {
      const data = await fetchUserProfile(username)
      // Parse backend IDs (matchId_minute_type) back to objects
      const history: SuccessfulPrediction[] = data.guessed.map((id) => {
        // Handle both legacy '_' and temporary ':' delimiters robustly
        const delimiter = id.includes(':') ? ':' : '_'
        const parts = id.split(delimiter)
        const eventType = parts.pop() || ''
        const minuteStr = parts.pop() || '0'
        const matchId = parts.join(delimiter)
        
        return {
          matchId,
          minute: parseInt(minuteStr, 10),
          eventType,
        }
      })

      set({
        profile: { username, score: data.score, lastHits: [] },
        successfulPredictions: history,
      })
    } catch (e) {
      console.error('Failed to sync user history:', e)
    }
  },

  addSuccessfulPrediction: (p) =>
    set((s) => ({
      successfulPredictions: [...s.successfulPredictions, p],
    })),

  applyHit: (record) =>
    set((s) => {
      const hit: HitRecord = {
        id: record.id,
        earnedPoints: record.earnedPoints,
        timestamp: record.timestamp ?? Date.now(),
      }
      const nextHits = [hit, ...s.profile.lastHits].slice(0, 8)
      return {
        profile: {
          ...s.profile,
          score: s.profile.score + record.earnedPoints,
          lastHits: nextHits,
        },
      }
    }),

  addScore: (points = 1) =>
    set((s) => ({
      profile: { ...s.profile, score: s.profile.score + points },
    })),
}))
