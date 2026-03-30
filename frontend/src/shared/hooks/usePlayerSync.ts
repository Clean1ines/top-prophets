import { useEffect, useMemo, useState } from 'react'

export function usePlayerSync(startTimeUnixSeconds: number | null) {
  const [tick, setTick] = useState(() => 0)

  useEffect(() => {
    if (startTimeUnixSeconds === null) return
    const t = window.setInterval(() => setTick((v) => v + 1), 250)
    return () => window.clearInterval(t)
  }, [startTimeUnixSeconds])

  const currentSecond = useMemo(() => {
    if (startTimeUnixSeconds === null) return 0
    return Date.now() / 1000 - startTimeUnixSeconds
  }, [startTimeUnixSeconds, tick])

  return currentSecond
}

