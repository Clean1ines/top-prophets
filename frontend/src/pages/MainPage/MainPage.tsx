import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StreamTheater from '../../widgets/StreamTheater/StreamTheater'
import LiveStats from '../../widgets/LiveStats/LiveStats'
import MatchDashboard from '../../widgets/MatchDashboard/MatchDashboard'
import PredictMomentum from '../../features/PredictMomentum/PredictMomentum'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import { useUserStore } from '../../entities/user/store/useUserStore'
import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'

export default function MainPage() {
  const matches = useMatchStore((s) => s.matches)

  const setUsername = useUserStore((s) => s.setUsername)
  const username = useUserStore((s) => s.profile.username)
  const score = useUserStore((s) => s.profile.score)

  const [mobileTab, setMobileTab] = useState<'events' | 'predictions' | 'leaderboard'>('events')

  useEffect(() => {
    const name = 'guest'
    setUsername(name)
  }, [setUsername])

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-10 bg-black">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Typography as="h2" variant="h2" className="text-accent-gold">
              TOP-PROPHETS
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm px-3 py-2 border border-white/20 rounded-full text-white/80">
              {username} <span className="text-accent-gold font-bold ml-1">{score} pts</span>
            </div>
          </div>
        </header>

        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
          <div className="space-y-4">
            <StreamTheater />

            {/* Mobile tabs under player */}
            <div className="md:hidden">
              <div className="mt-3 flex rounded-3xl bg-white/[0.04] p-1 text-xs text-white/70">
                {(['events', 'predictions', 'leaderboard'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMobileTab(tab)}
                    className={
                      mobileTab === tab
                        ? 'flex-1 rounded-2xl bg-white text-black py-2 font-semibold transition-colors'
                        : 'flex-1 rounded-2xl py-2 hover:bg-white/5 transition-colors'
                    }
                  >
                    {tab === 'events' ? 'Events' : tab === 'predictions' ? 'Predictions' : 'Leaderboard'}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mobileTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    {mobileTab === 'events' && <MatchDashboard />}
                    {mobileTab === 'predictions' && <PredictMomentum />}
                    {mobileTab === 'leaderboard' && <LiveStats />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Desktop right column */}
          <div className="hidden md:block space-y-4">
            <LiveStats />
            <PredictMomentum />
          </div>
        </div>

        {/* We hide MatchDashboard behind tabs on mobile, but show full dashboard on desktop below */}
        <div className="hidden md:block">
            <MatchDashboard />
        </div>
      </div>
    </div>
  )
}