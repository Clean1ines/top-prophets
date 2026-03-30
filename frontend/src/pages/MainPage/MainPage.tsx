import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StreamTheater from '../../widgets/StreamTheater/StreamTheater'
import LiveStats from '../../widgets/LiveStats/LiveStats'
import MatchDashboard from '../../widgets/MatchDashboard/MatchDashboard'
import PredictMomentum from '../../features/PredictMomentum/PredictMomentum'
import { fetchMatchesByCategory } from '../../shared/api/matchApi'
import { useMatchStore } from '../../entities/match/store/useMatchStore'
import { useUserStore } from '../../entities/user/store/useUserStore'
import GlassCard from '../../shared/ui/GlassCard/GlassCard'
import Typography from '../../shared/ui/Typography/Typography'
import ActionButton from '../../shared/ui/ActionButton/ActionButton'
import { getGoogleLoginUrl } from '../../shared/api/authApi'

export default function MainPage() {
  const setMatches = useMatchStore((s) => s.setMatches)
  const matches = useMatchStore((s) => s.matches)

  const setUsername = useUserStore((s) => s.setUsername)
  const username = useUserStore((s) => s.profile.username)

  const [loading, setLoading] = useState(true)
  const [mobileTab, setMobileTab] = useState<'events' | 'predictions' | 'leaderboard'>('events')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromOAuthUsername = params.get('username')
    const authOk = params.get('auth_ok') === '1'

    const storedNick = window.localStorage.getItem('tp_nickname') || ''

    if (authOk && fromOAuthUsername) {
      setUsername(fromOAuthUsername)
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (storedNick) {
      setUsername(storedNick)
    } else {
      const name = `fan_${Math.floor(Math.random() * 1000)}`
      setUsername(name)
    }

    setLoading(true)
    
    // Вызываем загрузку конкретной категории вместо абстрактного fetchMatches
    // Это исправляет баг, когда в demoMode грузилось всё подряд без фильтра
    fetchMatchesByCategory('dota2')
      .then((res) => {
        setMatches(res.matches)
        
        // Устанавливаем первый матч активным, чтобы плеер не тупил
        if (res.matches && res.matches.length > 0) {
          useMatchStore.getState().setActiveMatchId(res.matches[0].id)
        }
      })
      .catch((err) => console.error("Failed to load matches:", err))
      .finally(() => setLoading(false))
  }, [setMatches, setUsername])

  const onGoogleLogin = () => {
    window.location.href = getGoogleLoginUrl()
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-10 bg-black">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Typography as="h2" variant="h2" className="text-accent-gold">
              TOP-PROPHETS
            </Typography>
            <Typography variant="small" className="text-white/65">
              Прототип · FSD слои · Live-попадания по таймкоду
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-sm text-white/60">{loading ? 'Инициализация...' : `${matches.length} матчей`}</div>
            <ActionButton onClick={onGoogleLogin} className="text-sm px-3 py-2">
              Login with Google {username !== 'guest' ? `(${username})` : ''}
            </ActionButton>
          </div>
        </header>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <GlassCard className="min-h-[380px] animate-pulse"><span /></GlassCard>
            <GlassCard className="min-h-[380px] animate-pulse"><span /></GlassCard>
          </div>
        ) : (
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
                      {mobileTab === 'events' && <LiveStats />}
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
        )}

        <MatchDashboard />
      </div>
    </div>
  )
}