import { useEffect, useRef, useState } from 'react'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import type { TimelineEvent } from '../../entities/match/model/match'

/**
 * Hook that synchronises live events based on the active match's timeline.
 *
 * It continuously compares the current wall‑clock time with the match's start
 * time plus each event's `video_time_seconds`. When an event's time is reached,
 * it is added to the store's `liveEvents` list. Duplicate events are prevented.
 *
 * @returns The current offset in seconds from the match start (0 if no start time)
 */
export function usePlayerSync(): number {
  const activeMatch = useMatchStore((state) => state.getActiveMatch())
  const addLiveEvent = useMatchStore((state) => state.addLiveEvent)

  const [currentOffset, setCurrentOffset] = useState<number>(0)
  const dispatchedEvents = useRef<Set<number>>(new Set())

  useEffect(() => {
    // Reset dispatched events when the active match changes
    dispatchedEvents.current.clear()

    if (!activeMatch?.startTimeUnix || !activeMatch.timeline?.length) {
      setCurrentOffset(0)
      return
    }

    const { startTimeUnix, timeline } = activeMatch

    const intervalId = window.setInterval(() => {
      const nowSec = Date.now() / 1000
      const offset = Math.max(0, nowSec - startTimeUnix)
      setCurrentOffset(offset)

      // Check for events whose time has been reached but not yet dispatched
      timeline.forEach((event: TimelineEvent, idx: number) => {
        if (
          !dispatchedEvents.current.has(idx) &&
          event.video_time_seconds <= offset
        ) {
          dispatchedEvents.current.add(idx)
          addLiveEvent(event.text)
        }
      })
    }, 1000) // check every second

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeMatch?.id, activeMatch?.startTimeUnix, activeMatch?.timeline, addLiveEvent])

  return currentOffset
}
