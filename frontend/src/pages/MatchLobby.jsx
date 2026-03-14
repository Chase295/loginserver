import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiHandThumbUp, HiHandThumbDown, HiSparkles, HiStar, HiCheck, HiXMark, HiLink } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

export default function MatchLobby() {
  const { matchId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [tab, setTab] = useState('swipe')
  const [stats, setStats] = useState(null)
  const [unswiped, setUnswiped] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pool, setPool] = useState([])
  const [matches, setMatches] = useState([])
  const [lastMatch, setLastMatch] = useState(null)
  // Pool links
  const [links, setLinks] = useState([])
  const [myWatchlists, setMyWatchlists] = useState([])
  const [linkMovies, setLinkMovies] = useState({}) // wl_id -> movies[]

  useEffect(() => { fetchAll() }, [matchId])

  const fetchAll = async () => {
    try {
      const [matchRes, statsRes, unswipedRes, poolRes, matchesRes, linksRes, wlRes] = await Promise.all([
        api.get(`/match/${matchId}`),
        api.get(`/match/${matchId}/stats`),
        api.get(`/match/${matchId}/unswiped`),
        api.get(`/match/${matchId}/pool`),
        api.get(`/match/${matchId}/matches`),
        api.get(`/match/${matchId}/links`),
        api.get('/watchlist/lists'),
      ])
      setMatch(matchRes.data)
      setStats(statsRes.data)
      setUnswiped(unswipedRes.data)
      setPool(poolRes.data)
      setMatches(matchesRes.data)
      setLinks(linksRes.data)
      setMyWatchlists(wlRes.data)
      setCurrentIdx(0)
    } catch {}
  }

  const refreshStats = () => {
    api.get(`/match/${matchId}/stats`).then(r => setStats(r.data)).catch(() => {})
    api.get(`/match/${matchId}/matches`).then(r => setMatches(r.data)).catch(() => {})
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
      refreshStats()
    } catch {}
  }

  const toggleLink = async (wlId) => {
    const isLinked = links.some(l => l.watchlist_id === wlId)
    try {
      if (isLinked) {
        await api.delete(`/match/${matchId}/links/${wlId}`)
      } else {
        await api.post(`/match/${matchId}/links`, { watchlist_id: wlId })
      }
      fetchAll()
    } catch {}
  }

  const toggleExclude = async (wlId, movieId) => {
    try {
      await api.put(`/match/${matchId}/links/${wlId}/exclude`, { movie_id: movieId })
      fetchAll()
    } catch {}
  }

  const loadLinkMovies = async (wlId) => {
    if (linkMovies[wlId]) {
      setLinkMovies(prev => { const n = {...prev}; delete n[wlId]; return n })
      return
    }
    try {
      const res = await api.get(`/watchlist/movies`, { params: { watchlist_id: wlId } })
      setLinkMovies(prev => ({ ...prev, [wlId]: res.data }))
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
        <div className="glass p-4 text-center border-green-500/30 border bg-green-500/10">
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
        currentMovie ? (
          <div className="glass overflow-hidden">
            <div className="relative aspect-[2/3] max-h-[45vh] overflow-hidden">
              {currentMovie.poster_url ? (
                <img src={`${TMDB_IMG}/w500${currentMovie.poster_url}`} alt={currentMovie.title} className="w-full h-full object-cover" />
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
              <button onClick={() => vote(false)} className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center active:scale-90 transition-all">
                <HiHandThumbDown className="w-8 h-8" />
              </button>
              <button onClick={() => vote(true)} className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center active:scale-90 transition-all">
                <HiHandThumbUp className="w-8 h-8" />
              </button>
            </div>

            <div className="px-4 pb-4">
              <div className="w-full bg-white/10 rounded-full h-1">
                <div className="bg-primary-500 h-1 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / unswiped.length) * 100}%` }} />
              </div>
              <p className="text-xs text-white/30 text-center mt-2">{currentIdx + 1} / {unswiped.length}</p>
            </div>
          </div>
        ) : (
          <div className="glass p-8 text-center space-y-3">
            <p className="text-4xl">✅</p>
            <p className="text-white/50">Alle Filme geswiped!</p>
            <p className="text-xs text-white/30">Verlinke weitere Watchlists im Pool-Tab oder warte auf neue Filme.</p>
          </div>
        )
      )}

      {/* MATCHES TAB */}
      {tab === 'matches' && (
        matches.length === 0 ? (
          <div className="glass p-8 text-center text-white/30">
            <p className="text-4xl mb-3">🤝</p>
            <p>Noch keine gemeinsamen Matches</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="glass p-4 text-center">
              <p className="text-2xl font-bold gradient-text">{matches.length}</p>
              <p className="text-xs text-white/40">gemeinsame Matches</p>
            </div>
            {matches.map(movie => (
              <div key={movie.id} className="glass p-3 flex items-center gap-3">
                {movie.poster_url && (
                  <img src={`${TMDB_IMG}/w92${movie.poster_url}`} alt={movie.title} className="w-12 h-18 object-cover rounded-lg shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{movie.title}</p>
                  {movie.year && <p className="text-xs text-white/40">{movie.year}</p>}
                </div>
                <HiSparkles className="w-5 h-5 text-green-400 shrink-0" />
              </div>
            ))}
          </div>
        )
      )}

      {/* POOL TAB - Watchlist Linker */}
      {tab === 'pool' && (
        <div className="space-y-4">
          {/* Watchlists to link */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Watchlists verlinken</p>
            <div className="space-y-2">
              {myWatchlists.map(wl => {
                const isLinked = links.some(l => l.watchlist_id === wl.id)
                const link = links.find(l => l.watchlist_id === wl.id)
                const excludeCount = link?.excludes?.length || 0
                const isExpanded = !!linkMovies[wl.id]

                return (
                  <div key={wl.id} className="glass overflow-hidden">
                    {/* Watchlist header */}
                    <div className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => toggleLink(wl.id)}
                        className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                          isLinked
                            ? 'bg-green-500 text-white'
                            : 'bg-white/[0.06] text-white/20'
                        }`}
                      >
                        {isLinked && <HiCheck className="w-5 h-5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {wl.icon} {wl.name}
                        </p>
                        <p className="text-[11px] text-white/30">
                          {wl.movie_count} Filme
                          {excludeCount > 0 && ` · ${excludeCount} ausgeschlossen`}
                        </p>
                      </div>

                      {isLinked && wl.movie_count > 0 && (
                        <button
                          onClick={() => loadLinkMovies(wl.id)}
                          className="text-xs text-primary-400/60 px-2 py-1 active:opacity-70"
                        >
                          {isExpanded ? 'Schließen' : 'Ausnahmen'}
                        </button>
                      )}
                    </div>

                    {/* Expanded: show movies with exclude toggles */}
                    {isLinked && isExpanded && linkMovies[wl.id] && (
                      <div className="border-t border-white/[0.04] px-2 py-1">
                        {linkMovies[wl.id].map(movie => {
                          const isExcluded = (link?.excludes || []).includes(movie.id)
                          return (
                            <button
                              key={movie.id}
                              onClick={() => toggleExclude(wl.id, movie.id)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg active:bg-white/[0.04] transition-colors"
                            >
                              <div className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center transition-all ${
                                isExcluded
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-green-500/20 text-green-400'
                              }`}>
                                {isExcluded ? <HiXMark className="w-3.5 h-3.5" /> : <HiCheck className="w-3.5 h-3.5" />}
                              </div>
                              {movie.poster_url && (
                                <img src={`${TMDB_IMG}/w92${movie.poster_url}`} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
                              )}
                              <span className={`text-sm truncate ${isExcluded ? 'text-white/30 line-through' : ''}`}>
                                {movie.title}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pool summary */}
          {pool.length > 0 && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
                Aktuelle Pool-Filme ({pool.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pool.map(m => (
                  <div key={m.id} className="w-12 h-18 rounded-lg overflow-hidden" title={m.title}>
                    {m.poster_url ? (
                      <img src={`${TMDB_IMG}/w92${m.poster_url}`} alt={m.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/[0.06] flex items-center justify-center text-[10px]">🎬</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
