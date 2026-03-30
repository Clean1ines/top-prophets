import { create } from 'zustand'
import type { HitRecord, UserProfile } from '../model/user'

type UserStore = {
  profile: UserProfile
  setUsername: (username: string) => void
  applyHit: (record: Omit<HitRecord, 'timestamp'> & { timestamp?: number }) => void
}

export const useUserStore = create<UserStore>((set) => ({
  profile: {
    username: 'guest',
    score: 0,
    lastHits: [],
  },

  setUsername: (username) =>
    set((s) => ({
      profile: {
        ...s.profile,
        username,
      },
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
}))

