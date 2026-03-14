import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiFilm, HiUserGroup, HiSparkles, HiArrowRight, HiStar } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ total: 0, watched: 0, planned: 0 })
  const [trending, setTrending] = useState([])
  const [recentMovies, setRecentMovies] = useState([])

  useEffect(() => {
    api.get('/watchlist/movies').then(res => {
      const movies = res.data
      setRecentMovies(movies.slice(0, 6))
      setStats({
        total: movies.length,
        watched: movies.filter(m => m.status === 'watched').length,
        planned: movies.filter(m => m.status === 'watchlist').length,
      })
    }).catch(() => {})

    api.get('/media/trending').then(res => {
      setTrending(res.data.results?.slice(0, 10) || [])
    }).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold">
          Hey, <span className="gradient-text">{user?.username}</span>
        </h1>
        <p className="text-white/40 mt-1">Was willst du heute schauen?</p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Gesamt', value: stats.total, icon: HiFilm, color: 'from-primary-500 to-purple-500' },
          { label: 'Geschaut', value: stats.watched, icon: HiStar, color: 'from-green-500 to-emerald-500' },
          { label: 'Geplant', value: stats.planned, icon: HiSparkles, color: 'from-amber-500 to-orange-500' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-4 text-center"
          >
            <div className={`w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-white/40">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Trending</h2>
            <Link to="/discover" className="text-primary-400 text-sm flex items-center gap-1 hover:text-primary-300">
              Alle <HiArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
            {trending.map((item) => (
              <Link
                key={item.id}
                to="/discover"
                className="snap-start shrink-0 w-32 movie-card"
              >
                <div className="aspect-[2/3] overflow-hidden">
                  {item.poster_path ? (
                    <img
                      src={`${TMDB_IMG}/w342${item.poster_path}`}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-900 to-purple-900" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{item.title || item.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent from Watchlist */}
      {recentMovies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Zuletzt hinzugefügt</h2>
            <Link to="/watchlist" className="text-primary-400 text-sm flex items-center gap-1 hover:text-primary-300">
              Alle <HiArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {recentMovies.map((movie) => (
              <Link key={movie.id} to="/watchlist" className="movie-card">
                <div className="aspect-[2/3] overflow-hidden">
                  {movie.poster_url ? (
                    <img
                      src={`${TMDB_IMG}/w342${movie.poster_url}`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-900 to-purple-900 flex items-center justify-center">
                      <HiFilm className="w-8 h-8 text-white/20" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{movie.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/friends" className="glass p-4 flex items-center gap-3 hover:border-primary-400/30 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <HiUserGroup className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-sm">Freunde</div>
            <div className="text-xs text-white/40">Watchlists teilen</div>
          </div>
        </Link>
        <Link to="/groups" className="glass p-4 flex items-center gap-3 hover:border-primary-400/30 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <HiFilm className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-sm">Gruppen</div>
            <div className="text-xs text-white/40">Gemeinsam schauen</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
