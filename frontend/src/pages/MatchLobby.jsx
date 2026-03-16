import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiHandThumbUp, HiHandThumbDown, HiSparkles, HiStar, HiCheck, HiXMark, HiLink, HiEye, HiLockClosed, HiTrash, HiInformationCircle, HiCheckCircle } from 'react-icons/hi2'
import api from '../api/client'
import Modal from '../components/Modal'
import MovieDetailModal from '../components/MovieDetailModal'
import { useAuth } from '../context/AuthContext'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

function SwipeCard({ movie, idx, total, style = {}, swipeOpacity, swipeX = 0, pointerEvents = true, onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onClick }) {
  if (!movie) return null
  return (
    <div
      className="absolute inset-0 rounded-2xl overflow-hidden select-none"
      style={{
        ...style,
        zIndex: pointerEvents ? 20 : 10,
        pointerEvents: pointerEvents ? 'auto' : 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {movie.poster_url ? (
        <img src={`${TMDB_IMG}/w780${movie.poster_url}`} alt={movie.title} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900 to-purple-900 flex items-center justify-center">
          <span className="text-6xl">🎬</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      {swipeOpacity === 'like' && (
        <div className="absolute top-8 left-6 z-10 px-5 py-2 rounded-xl border-[3px] border-green-400 text-green-400 text-3xl font-black uppercase rotate-[-15deg]"
          style={{ opacity: Math.min(Math.abs(swipeX) / 100, 1) }}>
          LIKE
        </div>
      )}
      {swipeOpacity === 'nope' && (
        <div className="absolute top-8 right-6 z-10 px-5 py-2 rounded-xl border-[3px] border-red-400 text-red-400 text-3xl font-black uppercase rotate-[15deg]"
          style={{ opacity: Math.min(Math.abs(swipeX) / 100, 1) }}>
          NOPE
        </div>
      )}

      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 text-[11px] text-white/70 z-10">
        {idx} / {total}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-20 pt-4 z-10">
        <h2 className="text-xl font-bold leading-tight drop-shadow-lg">{movie.title}</h2>
        <div className="flex items-center gap-2 mt-1 text-sm text-white/80 flex-wrap">
          {movie.year && <span>{movie.year}</span>}
          {movie.media_type && (
            <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] uppercase font-semibold">
              {movie.media_type === 'tv' ? 'Serie' : 'Film'}
            </span>
          )}
          {movie.vote_average > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <HiStar className="w-3.5 h-3.5" /> {movie.vote_average.toFixed(1)}
            </span>
          )}
        </div>
        {movie.genres?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(Array.isArray(movie.genres) ? movie.genres : []).slice(0, 4).map((g, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] text-white/70 font-medium">
                {typeof g === 'object' ? g.name : g}
              </span>
            ))}
          </div>
        )}
        {movie.overview && (
          <p className="text-xs text-white/50 mt-1.5 line-clamp-2">{movie.overview}</p>
        )}
      </div>
    </div>
  )
}

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
  // Ready
  const [readyLoading, setReadyLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [detailMovie, setDetailMovie] = useState(null)
  // Swipe gesture
  const [swipeX, setSwipeX] = useState(0)
  const [swipeOpacity, setSwipeOpacity] = useState(null) // 'like' | 'nope' | null
  const [isAnimating, setIsAnimating] = useState(false)
  const [voteHistory, setVoteHistory] = useState([]) // stack of {movie} for undo
  const touchStart = useRef(null)
  const touchStartY = useRef(null)
  const cardRef = useRef(null)

  const fetchAll = useCallback(async () => {
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
  }, [matchId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Lock body scroll when swipe tab is active
  useEffect(() => {
    const isSwipe = tab === 'swipe' && match?.status === 'active'
    if (isSwipe) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${window.scrollY}px`
    }
    return () => {
      const top = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (top) window.scrollTo(0, parseInt(top) * -1)
    }
  }, [tab, match?.status])

  // Keyboard support: arrow keys for swiping
  useEffect(() => {
    if (tab !== 'swipe' || match?.status !== 'active') return
    const handleKey = (e) => {
      if (isAnimating || !unswiped[currentIdx]) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        animateSwipeOut(false)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        animateSwipeOut(true)
      } else if (e.key === 'ArrowDown' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        undoVote()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [tab, match?.status, isAnimating, currentIdx, unswiped])

  // Poll match status every 5s while in lobby (to detect partner becoming ready)
  useEffect(() => {
    if (!match || match.status !== 'lobby') return
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/match/${matchId}`)
        setMatch(res.data)
        // If match went active, do a full refresh
        if (res.data.status === 'active') {
          fetchAll()
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [match?.status, matchId, fetchAll])

  const refreshStats = () => {
    api.get(`/match/${matchId}/stats`).then(r => setStats(r.data)).catch(() => {})
    api.get(`/match/${matchId}/matches`).then(r => setMatches(r.data)).catch(() => {})
  }

  const vote = async (liked) => {
    const movie = unswiped[currentIdx]
    if (!movie) return
    // Immediately remove from list (no flash of old card)
    const newUnswiped = unswiped.filter((_, i) => i !== currentIdx)
    setUnswiped(newUnswiped)
    if (currentIdx >= newUnswiped.length) {
      setCurrentIdx(Math.max(0, newUnswiped.length - 1))
    }
    setVoteHistory(prev => [...prev, movie])
    try {
      const res = await api.post(`/match/${matchId}/like`, { movie_id: movie.id, liked })
      if (res.data.is_match) {
        setLastMatch(movie)
        setTimeout(() => setLastMatch(null), 3000)
      }
      refreshStats()
    } catch {}
  }

  const undoVote = async () => {
    if (voteHistory.length === 0) return
    const lastMovie = voteHistory[voteHistory.length - 1]
    try {
      await api.delete(`/match/${matchId}/like/${lastMovie.id}`)
      setVoteHistory(prev => prev.slice(0, -1))
      // Re-insert at beginning
      setUnswiped(prev => [lastMovie, ...prev])
      setCurrentIdx(0)
      refreshStats()
    } catch {}
  }

  const SWIPE_THRESHOLD = 80

  const swipeDirection = useRef(null) // 'horizontal' | 'vertical' | null

  const handleTouchStart = (e) => {
    if (isAnimating) return
    touchStart.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    swipeDirection.current = null
  }

  const handleTouchMove = (e) => {
    if (!touchStart.current || isAnimating) return
    const deltaX = e.touches[0].clientX - touchStart.current
    const deltaY = e.touches[0].clientY - touchStartY.current

    // Lock direction on first significant movement
    if (!swipeDirection.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
    }

    // Only process horizontal swipes
    if (swipeDirection.current !== 'horizontal') return

    // Block ALL scroll during horizontal swipe
    e.preventDefault()
    e.stopPropagation()

    setSwipeX(deltaX)
    if (deltaX > 40) setSwipeOpacity('like')
    else if (deltaX < -40) setSwipeOpacity('nope')
    else setSwipeOpacity(null)
  }

  const handleTouchEnd = () => {
    if (isAnimating) return
    if (swipeDirection.current === 'horizontal' && Math.abs(swipeX) > SWIPE_THRESHOLD) {
      animateSwipeOut(swipeX > 0)
    } else {
      setSwipeX(0)
      setSwipeOpacity(null)
    }
    touchStart.current = null
    swipeDirection.current = null
  }

  const lastDeltaX = useRef(0)

  const handleMouseDown = (e) => {
    if (isAnimating) return
    touchStart.current = e.clientX
    touchStartY.current = e.clientY
    lastDeltaX.current = 0
    const onMove = (ev) => {
      const deltaX = ev.clientX - touchStart.current
      lastDeltaX.current = deltaX
      setSwipeX(deltaX)
      if (deltaX > 40) setSwipeOpacity('like')
      else if (deltaX < -40) setSwipeOpacity('nope')
      else setSwipeOpacity(null)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (Math.abs(lastDeltaX.current) > SWIPE_THRESHOLD) {
        animateSwipeOut(lastDeltaX.current > 0)
      } else {
        setSwipeX(0)
        setSwipeOpacity(null)
      }
      touchStart.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const animatingRef = useRef(false)

  const animateSwipeOut = (liked) => {
    if (animatingRef.current) return
    animatingRef.current = true
    setIsAnimating(true)
    setSwipeX(liked ? 500 : -500)
    setSwipeOpacity(liked ? 'like' : 'nope')
    setTimeout(() => {
      // Card has flown off screen. Now instantly switch.
      setSwipeX(0)
      setSwipeOpacity(null)
      setIsAnimating(false)
      animatingRef.current = false
      vote(liked)
    }, 180)
  }

  const handleButtonVote = (liked) => {
    if (isAnimating) return
    animateSwipeOut(liked)
  }

  const handleCardTap = (e) => {
    // Only open detail if it wasn't a swipe (small movement)
    if (Math.abs(swipeX) < 5 && currentMovie) {
      setDetailMovie(currentMovie)
    }
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

  const toggleReady = async () => {
    setReadyLoading(true)
    try {
      const res = await api.post(`/match/${matchId}/ready`)
      // Refresh match to get updated status
      const matchRes = await api.get(`/match/${matchId}`)
      setMatch(matchRes.data)
      // If match went active, full refresh
      if (matchRes.data.status === 'active') {
        fetchAll()
      }
    } catch {}
    setReadyLoading(false)
  }

  const markWatched = async (movie) => {
    if (!movie.watchlist_id) return
    try {
      await api.put(`/watchlist/movies/${movie.id}`, { status: 'watched' })
      // Update local state
      setMatches(prev => prev.map(m => m.id === movie.id ? { ...m, status: 'watched' } : m))
    } catch {}
  }

  const deleteMatch = async () => {
    try {
      await api.delete(`/match/${matchId}`)
      navigate('/friends')
    } catch {}
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isPlayer1 = user?.id === match.player1_id
  const myReady = isPlayer1 ? match.player1_ready : match.player2_ready
  const partnerReady = isPlayer1 ? match.player2_ready : match.player1_ready
  const partnerName = isPlayer1 ? match.player2_username : match.player1_username
  const myName = isPlayer1 ? match.player1_username : match.player2_username

  const myLinks = links.filter(l => l.user_id === user?.id)
  const partnerLinks = links.filter(l => l.user_id !== user?.id)

  const currentMovie = unswiped[currentIdx]

  // --- LOBBY VIEW ---
  if (match.status === 'lobby') {
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
            <p className="text-xs text-amber-400/70">Lobby - Pool zusammenstellen</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="shrink-0 p-2 rounded-lg text-white/10 hover:text-red-400/60 hover:bg-red-500/10 transition-all active:scale-90"
            title="Match löschen"
          >
            <HiTrash className="w-5 h-5" />
          </button>
        </div>

        {/* Ready Status Banner */}
        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${myReady ? 'bg-green-400' : 'bg-white/20'}`} />
              <span className="text-sm">{myName}</span>
              {myReady && <span className="text-xs text-green-400">Bereit</span>}
            </div>
            <div className="flex items-center gap-3">
              {partnerReady && <span className="text-xs text-green-400">Bereit</span>}
              <span className="text-sm">{partnerName}</span>
              <div className={`w-3 h-3 rounded-full ${partnerReady ? 'bg-green-400' : 'bg-white/20'}`} />
            </div>
          </div>
        </div>

        {/* My Watchlists */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
            Meine Watchlists verlinken
          </p>
          <div className="space-y-2">
            {myWatchlists.map(wl => {
              const isLinked = myLinks.some(l => l.watchlist_id === wl.id)
              const link = links.find(l => l.watchlist_id === wl.id)
              const excludeCount = link?.excludes?.length || 0
              const isExpanded = !!linkMovies[wl.id]

              return (
                <div key={wl.id} className="glass overflow-hidden">
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
                        {isExpanded ? 'Schliessen' : 'Ausnahmen'}
                      </button>
                    )}
                  </div>

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

        {/* Partner's Watchlists (read-only) */}
        {partnerLinks.length > 0 && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
              <HiEye className="w-3 h-3 inline mr-1" />
              {partnerName}s Watchlists
            </p>
            <div className="space-y-2">
              {partnerLinks.map(link => (
                <div key={link.id} className="glass p-3 flex items-center gap-3 opacity-70">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center">
                    <HiLink className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {link.watchlist_icon} {link.watchlist_name}
                    </p>
                    <p className="text-[11px] text-white/30">
                      {link.movie_count} Filme
                      {(link.excludes?.length || 0) > 0 && ` · ${link.excludes.length} ausgeschlossen`}
                    </p>
                  </div>
                  <HiLockClosed className="w-4 h-4 text-white/15 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pool Stats */}
        {stats && stats.pool_total > 0 && (
          <div className="glass p-4 text-center">
            <p className="text-2xl font-bold gradient-text">{stats.pool_total}</p>
            <p className="text-xs text-white/40">Filme im Pool</p>
          </div>
        )}

        {/* Ready Button */}
        <button
          onClick={toggleReady}
          disabled={readyLoading}
          className={`w-full py-4 rounded-2xl text-base font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
            myReady
              ? 'bg-green-500/20 text-green-400 border-2 border-green-500/40'
              : 'bg-primary-500/20 text-primary-400 border-2 border-primary-400/30'
          }`}
        >
          {readyLoading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : myReady ? (
            <>
              <HiCheck className="w-6 h-6" />
              Bereit - Warte auf {partnerName}...
            </>
          ) : (
            <>Bereit</>
          )}
        </button>

        {myReady && !partnerReady && (
          <p className="text-xs text-white/30 text-center">
            {partnerName} muss auch bereit sein, damit das Match startet.
          </p>
        )}

        {/* Delete Confirm Modal */}
        <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Match löschen">
          <div className="text-center space-y-4">
            <p className="text-white/70">
              Match mit <span className="font-semibold text-white">{partnerName}</span> wirklich löschen?
            </p>
            <p className="text-xs text-white/30">Alle Votes und Matches gehen verloren.</p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2.5 rounded-xl bg-white/[0.06] text-white/60 text-sm font-medium active:scale-95 transition-transform"
              >
                Abbrechen
              </button>
              <button
                onClick={deleteMatch}
                className="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium active:scale-95 transition-transform"
              >
                Löschen
              </button>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // --- ACTIVE VIEW ---
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
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="shrink-0 p-2 rounded-lg text-white/10 hover:text-red-400/60 hover:bg-red-500/10 transition-all active:scale-90"
          title="Match löschen"
        >
          <HiTrash className="w-5 h-5" />
        </button>
      </div>

      {/* Match notification */}
      {lastMatch && (
        <div className="glass p-4 text-center border-green-500/30 border bg-green-500/10">
          <p className="text-lg">It's a Match!</p>
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
          <div className="flex items-center justify-center" style={{ height: 'calc(100dvh - 18rem - env(safe-area-inset-bottom, 0px))', touchAction: 'none' }}>
          <div className="relative w-full h-full max-w-md">

            {/* NEXT card (underneath) — always visible, no animation */}
            {unswiped[currentIdx + 1] && (
              <SwipeCard movie={unswiped[currentIdx + 1]} idx={currentIdx + 2} total={unswiped.length} style={{}} pointerEvents={false} />
            )}

            {/* CURRENT card (on top) — this one moves */}
            <SwipeCard
              movie={currentMovie}
              idx={currentIdx + 1}
              total={unswiped.length}
              style={{
                transform: `translateX(${swipeX}px) rotate(${swipeX * 0.04}deg)`,
                transition: isAnimating ? 'transform 0.18s ease-out' : 'none',
              }}
              swipeOpacity={swipeOpacity}
              swipeX={swipeX}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onClick={handleCardTap}
            />

            {/* Buttons overlay */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-5 z-30"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleButtonVote(false) }}
                disabled={isAnimating}
                className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm text-red-400 border border-red-400/40 flex items-center justify-center active:scale-90 transition-all"
              >
                <HiHandThumbDown className="w-7 h-7" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); undoVote() }}
                disabled={voteHistory.length === 0 || isAnimating}
                className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center active:scale-90 transition-all ${
                  voteHistory.length > 0
                    ? 'bg-black/50 text-amber-400 border border-amber-400/40'
                    : 'bg-black/30 text-white/20 border border-white/10'
                }`}
              >
                <HiArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleButtonVote(true) }}
                disabled={isAnimating}
                className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm text-green-400 border border-green-400/40 flex items-center justify-center active:scale-90 transition-all"
              >
                <HiHandThumbUp className="w-7 h-7" />
              </button>
            </div>
          </div>
          </div>
        ) : (
          <div className="glass p-8 text-center space-y-3">
            <p className="text-white/50">Alle Filme geswiped!</p>
            <p className="text-xs text-white/30">Verlinke weitere Watchlists im Pool-Tab oder warte auf neue Filme.</p>
          </div>
        )
      )}

      {/* Movie Detail Modal */}
      <MovieDetailModal
        movie={detailMovie}
        open={!!detailMovie}
        onClose={() => setDetailMovie(null)}
        readonly
      />

      {/* MATCHES TAB */}
      {tab === 'matches' && (
        matches.length === 0 ? (
          <div className="glass p-8 text-center text-white/30">
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
                {/* Poster + Info — klickbar für Details */}
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity"
                  onClick={() => setDetailMovie(movie)}
                >
                  {movie.poster_url && (
                    <img src={`${TMDB_IMG}/w92${movie.poster_url}`} alt={movie.title} className="w-12 h-[4.5rem] object-cover rounded-lg shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{movie.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {movie.year && <span className="text-xs text-white/40">{movie.year}</span>}
                      {movie.media_type && (
                        <span className="text-[10px] text-white/30 uppercase">{movie.media_type === 'tv' ? 'Serie' : 'Film'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gesehen-Button */}
                <button
                  onClick={() => markWatched(movie)}
                  className={`shrink-0 p-2 rounded-lg transition-all active:scale-90 ${
                    movie.status === 'watched'
                      ? 'text-green-400'
                      : 'text-white/15 hover:text-green-400/60 hover:bg-green-500/10'
                  }`}
                  title={movie.status === 'watched' ? 'Gesehen' : 'Als gesehen markieren'}
                >
                  <HiCheckCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* POOL TAB */}
      {tab === 'pool' && (
        <div className="space-y-4">
          {/* My Watchlists (editable) */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Meine Watchlists</p>
            <div className="space-y-2">
              {myWatchlists.map(wl => {
                const isLinked = myLinks.some(l => l.watchlist_id === wl.id)
                const link = links.find(l => l.watchlist_id === wl.id && l.user_id === user?.id)
                const excludeCount = link?.excludes?.length || 0
                const isExpanded = !!linkMovies[wl.id]

                return (
                  <div key={wl.id} className="glass overflow-hidden">
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
                          {isExpanded ? 'Schliessen' : 'Ausnahmen'}
                        </button>
                      )}
                    </div>

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

          {/* Partner's Watchlists (read-only) */}
          {partnerLinks.length > 0 && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
                <HiEye className="w-3 h-3 inline mr-1" />
                {partnerName}s Watchlists
              </p>
              <div className="space-y-2">
                {partnerLinks.map(link => (
                  <div key={link.id} className="glass p-3 flex items-center gap-3 opacity-70">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center">
                      <HiLink className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {link.watchlist_icon} {link.watchlist_name}
                      </p>
                      <p className="text-[11px] text-white/30">
                        {link.movie_count} Filme
                        {(link.excludes?.length || 0) > 0 && ` · ${link.excludes.length} ausgeschlossen`}
                      </p>
                    </div>
                    <HiLockClosed className="w-4 h-4 text-white/15 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      <div className="w-full h-full bg-white/[0.06] flex items-center justify-center text-[10px]">?</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info: changing pool resets ready */}
          {match.status === 'active' && (
            <p className="text-xs text-amber-400/50 text-center">
              Hinweis: Pool-Änderungen setzen den Bereit-Status zurück. Das Match geht zurück in die Lobby.
            </p>
          )}
        </div>
      )}

      {/* Delete Confirm Modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Match löschen">
        <div className="text-center space-y-4">
          <p className="text-white/70">
            Match mit <span className="font-semibold text-white">{partnerName}</span> wirklich löschen?
          </p>
          <p className="text-xs text-white/30">Alle Votes und Matches gehen verloren.</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-5 py-2.5 rounded-xl bg-white/[0.06] text-white/60 text-sm font-medium active:scale-95 transition-transform"
            >
              Abbrechen
            </button>
            <button
              onClick={deleteMatch}
              className="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium active:scale-95 transition-transform"
            >
              Löschen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
// v1773689485
