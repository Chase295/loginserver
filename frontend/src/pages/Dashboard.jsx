import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiFilm, HiUserGroup, HiSparkles, HiArrowRight, HiStar, HiCalendar, HiArrowDown, HiXMark } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import MovieDetailModal from '../components/MovieDetailModal'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

function formatSize(bytes) {
  if (!bytes) return '-'
  const gb = bytes / (1024 ** 3)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ total: 0, watched: 0, planned: 0, movies: 0, moviesWatched: 0, series: 0, seriesWatched: 0, episodes: 0, episodesWatched: 0 })
  const [trending, setTrending] = useState([])
  const [recentMovies, setRecentMovies] = useState([])
  const [calendar, setCalendar] = useState([])
  const [queue, setQueue] = useState([])
  const queueInterval = useRef(null)
  const [selectedMovie, setSelectedMovie] = useState(null)

  const loadMovies = () => {
    // Stats from sync overview (fast, no heavy data)
    api.get('/sync/overview').then(res => {
      const wl = res.data.watchlist
      setStats({
        total: wl.total, watched: wl.watched, planned: wl.by_status?.watchlist || 0,
        movies: wl.movies, moviesWatched: 0, series: wl.series, seriesWatched: 0,
        episodes: wl.episodes_watched,
      })
    }).catch(() => {})

    // Only load recent 6 for display (fast)
    api.get('/watchlist/movies').then(res => {
      setRecentMovies(res.data.slice(0, 6))
    }).catch(() => {})
  }

  useEffect(() => {
    loadMovies()
    api.get('/media/trending').then(res => {
      setTrending(res.data.results?.slice(0, 10) || [])
    }).catch(() => {})

    // Load calendar + queue for installer/admin
    if (user?.is_admin || user?.is_installer) {
      // Calendar: next 7 days from all Sonarr servers
      api.get('/sonarr/servers').then(async res => {
        const servers = res.data.filter(s => s.enabled !== false)
        const now = new Date()
        const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const allEps = []
        for (const srv of servers) {
          try {
            const cal = await api.get(`/sonarr/servers/${srv.id}/calendar`, {
              params: { start: now.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
            })
            cal.data.forEach(ep => allEps.push({ ...ep, _server: srv.name }))
          } catch {}
        }
        allEps.sort((a, b) => (a.airDateUtc || '').localeCompare(b.airDateUtc || ''))
        setCalendar(allEps.slice(0, 10))
      }).catch(() => {})

      // Queue: from all Sonarr + Radarr servers
      const loadQueue = async () => {
        const allQ = []
        try {
          const sonarrRes = await api.get('/sonarr/servers')
          for (const srv of sonarrRes.data.filter(s => s.enabled !== false)) {
            try {
              const q = await api.get(`/sonarr/servers/${srv.id}/queue`)
              ;(q.data?.records || []).forEach(r => allQ.push({ ...r, _type: 'sonarr', _server: srv.name }))
            } catch {}
          }
        } catch {}
        try {
          const radarrRes = await api.get('/radarr/servers')
          for (const srv of radarrRes.data.filter(s => s.enabled !== false)) {
            try {
              const q = await api.get(`/radarr/servers/${srv.id}/queue`)
              ;(q.data?.records || []).forEach(r => allQ.push({ ...r, _type: 'radarr', _server: srv.name }))
            } catch {}
          }
        } catch {}
        setQueue(allQ)
      }
      loadQueue()
      queueInterval.current = setInterval(loadQueue, 10000)
    }

    return () => clearInterval(queueInterval.current)
  }, [])

  // Open any item as modal — checks watchlist first, then fetches from TMDB
  const openTrending = async (item) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv')
    const tmdbId = item.id || item.tmdb_id

    // Check if already in watchlist (search all loaded movies)
    const allMovies = await api.get('/watchlist/movies').then(r => r.data).catch(() => [])
    const existing = allMovies.find(m => m.tmdb_id === tmdbId && m.media_type === mediaType)
    if (existing) {
      setSelectedMovie(existing)
      return
    }

    // If we have full TMDB data already (from trending)
    if (item.poster_path || item.overview) {
      setSelectedMovie({
        title: item.title || item.name,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        poster_url: item.poster_path,
        backdrop_path: item.backdrop_path,
        overview: item.overview,
        tmdb_id: tmdbId,
        media_type: mediaType,
        vote_average: item.vote_average,
        genres: item.genre_ids,
        status: 'watchlist',
        _readonly: true,
      })
      return
    }

    // Fetch from TMDB
    if (tmdbId) {
      try {
        const res = await api.get(`/media/${mediaType}/${tmdbId}`)
        const d = res.data
        setSelectedMovie({
          title: d.title || d.name || item.title,
          year: (d.release_date || d.first_air_date || '').slice(0, 4),
          poster_url: d.poster_path,
          backdrop_path: d.backdrop_path,
          overview: d.overview,
          tmdb_id: tmdbId,
          media_type: mediaType,
          vote_average: d.vote_average,
          genres: d.genres?.map(g => g.id),
          status: 'watchlist',
          _readonly: true,
        })
      } catch {
        // Fallback: minimal info
        setSelectedMovie({
          title: item.title || '?',
          tmdb_id: tmdbId,
          media_type: mediaType,
          status: 'watchlist',
          _readonly: true,
        })
      }
    }
  }

  const handleUpdate = async (movieId, data) => {
    try {
      const res = await api.put(`/watchlist/movies/${movieId}`, data)
      setRecentMovies(prev => prev.map(m => m.id === movieId ? { ...m, ...res.data } : m))
      setSelectedMovie(prev => prev?.id === movieId ? { ...prev, ...res.data } : prev)
      loadMovies()
    } catch {}
  }

  const handleDelete = async (movieId) => {
    try {
      await api.delete(`/watchlist/movies/${movieId}`)
      setRecentMovies(prev => prev.filter(m => m.id !== movieId))
      loadMovies()
    } catch {}
  }

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
          { label: 'Filme', value: stats.movies, sub: `${stats.moviesWatched} gesehen`, color: 'from-orange-500 to-amber-500' },
          { label: 'Serien', value: stats.series, sub: `${stats.seriesWatched} gesehen`, color: 'from-blue-500 to-cyan-500' },
          { label: 'Episoden', value: stats.episodes, sub: 'gesehen', color: 'from-purple-500 to-pink-500' },
        ].map(({ label, value, sub, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-4 text-center"
          >
            <div className={`w-10 h-10 mx-auto mb-2 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center relative overflow-hidden`}
                 style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
              <span className="text-sm font-bold text-white relative z-10">{label[0]}</span>
              <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" style={{ height: '50%' }} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[10px] text-white/40">{sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Downloads (installer/admin only) */}
      {(user?.is_admin || user?.is_installer) && queue.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
              <HiArrowDown className="w-4 h-4 text-white" />
            </span>
            Downloads
            <span className="text-xs text-white/30 font-normal ml-1">({queue.length})</span>
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x scrollbar-hide">
            {queue.slice(0, 8).map((item, i) => {
              const progress = item.sizeleft && item.size ? Math.round((1 - item.sizeleft / item.size) * 100) : 0
              const title = item.series?.title || item.movie?.title || '?'
              const episode = item.episode ? `S${String(item.episode.seasonNumber).padStart(2,'0')}E${String(item.episode.episodeNumber).padStart(2,'0')}` : ''
              const poster = item.series?.images?.find(i => i.coverType === 'poster')?.remoteUrl || item.movie?.images?.find(i => i.coverType === 'poster')?.remoteUrl
              const tmdbId = item.series?.tmdbId || item.movie?.tmdbId
              const mediaType = item.series ? 'tv' : 'movie'

              // Find in watchlist to make clickable
              const watchlistItem = recentMovies.find(m => m.tmdb_id === tmdbId)

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (watchlistItem) setSelectedMovie(watchlistItem)
                    else if (tmdbId) openTrending({ id: tmdbId, media_type: mediaType, title, poster_path: null })
                  }}
                  className="snap-start shrink-0 w-36 movie-card text-left relative"
                >
                  <div className="aspect-[2/3] overflow-hidden relative">
                    {poster ? (
                      <img src={poster} alt={title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
                        <HiArrowDown className="w-8 h-8 text-white/20" />
                      </div>
                    )}
                    {/* Progress overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${item._type === 'sonarr' ? 'bg-blue-400' : 'bg-orange-400'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-white/70 font-medium">{progress}%</span>
                      </div>
                      {item.timeleft && <p className="text-[9px] text-white/40">ETA: {item.timeleft}</p>}
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{title}</p>
                    {episode && <p className="text-[10px] text-white/40">{episode} · {formatSize(item.size)}</p>}
                    {!episode && <p className="text-[10px] text-white/40">{formatSize(item.size)}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </motion.section>
      )}

      {/* Kommende Episoden (installer/admin only) */}
      {(user?.is_admin || user?.is_installer) && calendar.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
              <HiCalendar className="w-4 h-4 text-white" />
            </span>
            Diese Woche
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {calendar.map((ep, i) => {
              const airDate = ep.airDateUtc ? new Date(ep.airDateUtc) : null
              const isPast = airDate && airDate < new Date()
              const isToday = airDate && airDate.toDateString() === new Date().toDateString()
              const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
              const isTomorrow = airDate && airDate.toDateString() === tomorrow.toDateString()
              const dayLabel = isToday ? 'Heute' : isTomorrow ? 'Morgen' : airDate?.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' })
              const poster = ep.series?.images?.find(i => i.coverType === 'poster')?.remoteUrl
              const tmdbId = ep.series?.tmdbId
              const watchlistItem = recentMovies.find(m => m.tmdb_id === tmdbId)

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (watchlistItem) setSelectedMovie(watchlistItem)
                    else if (tmdbId) openTrending({ id: tmdbId, media_type: 'tv', title: ep.series?.title, poster_path: null })
                  }}
                  className="text-left group"
                >
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden relative border border-white/[0.08] group-active:scale-95 transition-all duration-300">
                    {poster ? (
                      <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-900/50 to-emerald-900/50 flex items-center justify-center">
                        <HiCalendar className="w-5 h-5 text-white/20" />
                      </div>
                    )}
                    {/* Day badge top-left */}
                    <div className="absolute top-1 left-1">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold backdrop-blur-sm ${
                        isToday ? 'bg-green-500/90 text-white' : 'bg-black/60 text-white/80'
                      }`}>{dayLabel}</span>
                    </div>
                    {/* Status badge top-right */}
                    <div className="absolute top-1 right-1">
                      {ep.hasFile && <span className="w-2 h-2 rounded-full bg-green-400 block" />}
                      {isPast && !ep.hasFile && <span className="w-2 h-2 rounded-full bg-red-400 block" />}
                      {!isPast && !ep.hasFile && <span className="w-2 h-2 rounded-full bg-blue-400 block" />}
                    </div>
                    {/* Episode overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-3">
                      <p className="text-[9px] text-white/90 font-medium">
                        S{String(ep.seasonNumber).padStart(2,'0')}E{String(ep.episodeNumber).padStart(2,'0')}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-white/70 truncate mt-1 px-0.5">{ep.series?.title || '?'}</p>
                </button>
              )
            })}
          </div>
        </motion.section>
      )}

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
              <button
                key={item.id}
                onClick={() => openTrending(item)}
                className="snap-start shrink-0 w-32 movie-card text-left"
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
              </button>
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
              <button key={movie.id} onClick={() => setSelectedMovie(movie)} className="movie-card text-left">
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
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick Link */}
      <Link to="/friends" className="glass p-4 flex items-center gap-3 hover:border-white/[0.15] transition-all duration-300">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center relative overflow-hidden"
             style={{ boxShadow: '0 4px 16px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
          <HiUserGroup className="w-5 h-5 relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" style={{ height: '50%' }} />
        </div>
        <div>
          <div className="font-medium text-sm">Freunde</div>
          <div className="text-xs text-white/40">Watchlists teilen</div>
        </div>
      </Link>

      {/* Movie Detail Modal */}
      <MovieDetailModal
        movie={selectedMovie}
        open={!!selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onUpdate={selectedMovie?._readonly ? null : handleUpdate}
        onDelete={selectedMovie?._readonly ? null : handleDelete}
        readonly={selectedMovie?._readonly}
      />
    </div>
  )
}
