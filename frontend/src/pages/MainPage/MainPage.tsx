import { useEffect, useState } from 'react'
import StreamTheater from '../../widgets/StreamTheater/StreamTheater'
import MatchDashboard from '../../widgets/MatchDashboard/MatchDashboard'
import PredictMomentum from '../../features/PredictMomentum/PredictMomentum'
import { useUserStore } from '../../entities/user/store/useUserStore'

export default function MainPage() {
  const setUsername = useUserStore((s) => s.setUsername)
  const username = useUserStore((s) => s.profile.username)
  const [mobileTab, setMobileTab] = useState<'events' | 'leaderboard'>('events')

  useEffect(() => {
    if (!username || username === 'guest') {
      setUsername(`guest-${Math.floor(1000 + Math.random() * 9000)}`)
    }
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] min-h-screen">

        {/* Left column: video + control bar */}
        <div className="flex flex-col min-w-0">
          <StreamTheater />
          <PredictMomentum />

          {/* Mobile tabs */}
          <div className="lg:hidden border-t border-white/10">
            <div className="flex">
              {(['events', 'leaderboard'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMobileTab(tab)}
                  className={
                    mobileTab === tab
                      ? 'flex-1 py-2 text-sm font-semibold text-white border-b-2 border-white/80'
                      : 'flex-1 py-2 text-sm text-white/40 hover:text-white/70 transition-colors'
                  }
                >
                  {tab === 'events' ? 'Events' : 'Leaderboard'}
                </button>
              ))}
            </div>
            <div className="px-4 py-4">
              <MatchDashboard mobileTab={mobileTab} />
            </div>
          </div>
        </div>

        {/* Right column – desktop only */}
        <div className="hidden lg:flex flex-col border-l border-white/10">
          <MatchDashboard />
        </div>

      </div>
    </div>
  )
}