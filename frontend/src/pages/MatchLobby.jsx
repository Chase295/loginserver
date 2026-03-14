import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiHandThumbUp, HiHandThumbDown, HiPlus, HiTrash, HiSparkles, HiStar } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

export default function MatchLobby() {
  const { matchId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [tab, setTab] = useState('swipe') // swipe, pool, matches
  const [stats, setStats] = useState(null)
  const [unswiped, setUnswiped] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pool, setPool] = useState([])
  const [matches, setMatches] = useState([])
  const [showAddPool, setShowAddPool] = useState(false)
  const [myMovies, setMyMovies] = useState([])
  const [lastMatch, setLastMatch] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [matchId])

  const fetchAll = async () => {
    try {
      const [matchRes, statsRes, unswipedRes, poolRes, matchesRes] = await Promise.all([
        api.get(`/match/${matchId}`),
        api.get(`/match/${matchId}/stats`),
        api.get(`/match/${matchId}/unswiped`),
        api.get(`/match/${matchId}/pool`),
        api.get(`/match/${matchId}/matches`),
      ])
      setMatch(matchRes.data)
      setStats(statsRes.data)
      setUnswiped(unswipedRes.data)
      setPool(poolRes.data)
      setMatches(matchesRes.data)
      setCurrentIdx(0)
    } catch {}
  }

  const vote = async (liked) => {
    const movie = unswiped[currentIdx]
    if (!movie) return
    try {
      const res = await api.post(`/match/${matchId}/like`, { movie_id: movie.id, liked })
      if (res.data.is_match) {
        setLastMatch(movie)
        setTimeout(() => setLastMatch(null), 3000)
      }
      if (currentIdx + 1 >= unswiped.length) {
        fetchAll()
      } else {
        setCurrentIdx(prev => prev + 1)
      }
      // Update stats
      api.get(`/match/${matchId}/stats`).then(r => setStats(r.data)).catch(() => {})
      api.get(`/match/${matchId}/matches`).then(r => setMatches(r.data)).catch(() => {})
    } catch {}
  }

  const openAddPool = async () => {
    try {
      const res = await api.get('/watchlist/movies')
      const poolIds = new Set(pool.map(p => p.movie.id))
      setMyMovies(res.data.filter(m => !poolIds.has(m.id)))
    } catch {}
    setShowAddPool(true)
  }

  const addToPool = async (movieIds) => {
    try {
      await api.post(`/match/${matchId}/pool`, { movie_ids: movieIds })
      setShowAddPool(false)
      fetchAll()
    } catch {}
  }

  const removeFromPool = async (movieId) => {
    try {
      await api.delete(`/match/${matchId}/pool/${movieId}`)
      fetchAll()
    } catch {}
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currentMovie = unswiped[currentIdx]

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/friends')} className="glass-button p-2 rounded-lg">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">
            {match.player1_username} & {match.player2_username}
          </h1>
          {stats && (
            <p className="text-xs text-white/40">
              {stats.pool_total} im Pool · {stats.matches} Matches
            </p>
          )}
        </div>
      </div>

      {/* Match notification */}
      {lastMatch && (
        <div className="glass p-4 text-center border-green-500/30 border bg-green-500/10 animate-pulse">
          <p className="text-lg">🎉 It's a Match!</p>
          <p className="text-sm text-green-400 font-medium">{lastMatch.title}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'swipe', label: `Swipen${unswiped.length > 0 ? ` (${unswiped.length})` : ''}` },
          { id: 'matches', label: `Matches (${matches.length})` },
          { id: 'pool', label: `Pool (${stats?.pool_total || 0})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                : 'bg-white/[0.04] text-white/50 border border-white/[0.06]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SWIPE TAB */}
      {tab === 'swipe' && (
        <>
          {currentMovie ? (
            <div className="glass overflow-hidden">
              <div className="relative aspect-[2/3] max-h-[45vh] overflow-hidden">
                {currentMovie.poster_url ? (
                  <img
                    src={`${TMDB_IMG}/w500${currentMovie.poster_url}`}
                    alt={currentMovie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-900 to-purple-900 flex items-center justify-center">
                    <span className="text-5xl">🎬</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h2 className="text-xl font-bold">{currentMovie.title}</h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/60">
                    {currentMovie.year && <span>{currentMovie.year}</span>}
                    {currentMovie.vote_average > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <HiStar className="w-3.5 h-3.5" /> {currentMovie.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {currentMovie.overview && (
                <div className="px-4 py-3 border-t border-white/[0.06]">
                  <p className="text-xs text-white/50 line-clamp-3">{currentMovie.overview}</p>
                </div>
              )}

              <div className="p-4 flex justify-center gap-8">
                <button
                  onClick={() => vote(false)}
                  className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center active:scale-90 active:bg-red-500/30 transition-all"
                >
                  <HiHandThumbDown className="w-8 h-8" />
                </button>
                <button
                  onClick={() => vote(true)}
                  className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center active:scale-90 active:bg-green-500/30 transition-all"
                >
                  <HiHandThumbUp className="w-8 h-8" />
                </button>
              </div>

              <div className="px-4 pb-4">
                <div className="w-full bg-white/10 rounded-full h-1">
                  <div
                    className="bg-primary-500 h-1 rounded-full transition-all"
                    style={{ width: `${((currentIdx + 1) / unswiped.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-white/30 text-center mt-2">
                  {currentIdx + 1} / {unswiped.length}
                </p>
              </div>
            </div>
          ) : (
            <div className="glass p-8 text-center space-y-4">
              <p className="text-4xl">✅</p>
              <p className="text-white/50">Alle Filme geswiped!</p>
              <p className="text-xs text-white/30">
                Füge neue Filme zum Pool hinzu oder warte bis dein Partner neue hinzufügt.
              </p>
              <button onClick={openAddPool} className="btn-primary text-sm">
                <HiPlus className="w-4 h-4 inline mr-1.5" />Filme hinzufügen
              </button>
            </div>
          )}
        </>
      )}

      {/* MATCHES TAB */}
      {tab === 'matches' && (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="glass p-8 text-center text-white/30">
              <p className="text-4xl mb-3">🤝</p>
              <p>Noch keine gemeinsamen Matches</p>
              <p className="text-xs mt-1">Swiped beide Filme um Matches zu finden</p>
            </div>
          ) : (
            <>
              <div className="glass p-4 text-center mb-3">
                <p className="text-2xl font-bold gradient-text">{matches.length}</p>
                <p className="text-xs text-white/40">gemeinsame Matches</p>
              </div>
              {matches.map(movie => (
                <div key={movie.id} className="glass p-3 flex items-center gap-3">
                  {movie.poster_url ? (
                    <img
                      src={`${TMDB_IMG}/w92${movie.poster_url}`}
                      alt={movie.title}
                      className="w-12 h-18 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-18 bg-white/[0.06] rounded-lg shrink-0 flex items-center justify-center">🎬</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{movie.title}</p>
                    {movie.year && <p className="text-xs text-white/40">{movie.year}</p>}
                  </div>
                  <HiSparkles className="w-5 h-5 text-green-400 shrink-0 ml-auto" />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* POOL TAB */}
      {tab === 'pool' && (
        <div className="space-y-3">
          <button onClick={openAddPool} className="btn-primary w-full text-sm">
            <HiPlus className="w-4 h-4 inline mr-1.5" />Filme aus Watchlist hinzufügen
          </button>

          {pool.length === 0 ? (
            <div className="glass p-8 text-center text-white/30">
              <p className="text-4xl mb-3">📋</p>
              <p>Pool ist leer</p>
              <p className="text-xs mt-1">Füge Filme aus deiner Watchlist hinzu</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pool.map(item => (
                <div key={item.id} className="glass-light p-3 flex items-center gap-3 rounded-xl">
                  {item.movie.poster_url ? (
                    <img
                      src={`${TMDB_IMG}/w92${item.movie.poster_url}`}
                      alt={item.movie.title}
                      className="w-10 h-15 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-15 bg-white/[0.06] rounded-lg shrink-0 flex items-center justify-center text-sm">🎬</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.movie.title}</p>
                    <p className="text-[11px] text-white/30">{item.movie.year}</p>
                  </div>
                  <button
                    onClick={() => removeFromPool(item.movie.id)}
                    className="shrink-0 p-1.5 text-red-400/50 active:text-red-400 active:scale-90 transition-all"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add to Pool Modal */}
      <Modal open={showAddPool} onClose={() => setShowAddPool(false)} title="Filme zum Pool hinzufügen">
        {myMovies.length === 0 ? (
          <p className="text-center text-white/30 py-8 text-sm">
            Alle deine Filme sind schon im Pool
          </p>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => addToPool(myMovies.map(m => m.id))}
              className="w-full glass-light p-3 rounded-xl text-sm font-medium text-primary-400 text-center active:bg-white/[0.06]"
            >
              Alle hinzufügen ({myMovies.length})
            </button>
            {myMovies.map(movie => (
              <button
                key={movie.id}
                onClick={() => addToPool([movie.id])}
                className="w-full glass-light p-3 flex items-center gap-3 rounded-xl text-left active:bg-white/[0.06]"
              >
                {movie.poster_url ? (
                  <img
                    src={`${TMDB_IMG}/w92${movie.poster_url}`}
                    alt={movie.title}
                    className="w-10 h-15 object-cover rounded-lg shrink-0"
                  />
                ) : (
                  <div className="w-10 h-15 bg-white/[0.06] rounded-lg shrink-0 flex items-center justify-center text-sm">🎬</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{movie.title}</p>
                  <p className="text-[11px] text-white/30">{movie.year}</p>
                </div>
                <HiPlus className="w-5 h-5 text-primary-400 shrink-0 ml-auto" />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
