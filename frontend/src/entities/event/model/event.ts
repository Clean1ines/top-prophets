export type EventType = 'goal' | 'shot' | 'pass' | 'save' | 'foul' | 'other'

export type GameEventWindow = {
  /** Acceptable hit window around timestamp (in seconds). */
  secondsBefore: number
  secondsAfter: number
}

export type GameEvent = {
  id: string
  type: EventType
  /** Timestamp in seconds from match start (0-based). */
  timestamp: number
  pointValue: number
  /** Window in which a hit is considered successful. */
  window: GameEventWindow
}

