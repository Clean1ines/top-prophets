import { create } from 'zustand'
import type { Match } from '../model/match'

type MatchStore = {
  matches: Match[]
  activeMatchId: string | null
  liveEvents: string[]

  setMatches: (matches: Match[]) => void
  setActiveMatchId: (id: string) => void
  clearActiveMatch: () => void
  addLiveEvent: (text: string) => void
  clearLiveEvents: () => void

  getActiveMatch: () => Match | null
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  matches: [],
  activeMatchId: null,
  liveEvents: [],

  setMatches: (matches) => {
    set({ matches })
    const state = get()
    if (!state.activeMatchId && matches.length > 0) {
      set({ activeMatchId: matches[0]!.id })
    }
  },
  setActiveMatchId: (id) => set({ activeMatchId: id }),
  clearActiveMatch: () => set({ activeMatchId: null }),
  addLiveEvent: (text) => {
    const { liveEvents } = get()
    // Avoid duplicate events
    if (!liveEvents.includes(text)) {
      set({ liveEvents: [...liveEvents, text] })
    }
  },
  clearLiveEvents: () => set({ liveEvents: [] }),
  getActiveMatch: () => {
    const state = get()
    if (!state.activeMatchId) return null
    return state.matches.find((m) => m.id === state.activeMatchId) ?? null
  },
}))
