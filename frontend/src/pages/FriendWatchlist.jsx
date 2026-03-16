import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiChevronDown, HiAdjustmentsHorizontal, HiStar } from 'react-icons/hi2'

import api from '../api/client'
import MovieCard from '../components/MovieCard'
import MovieDetailModal from '../components/MovieDetailModal'
import SearchBar from '../components/SearchBar'

const STATUSES = ['all', 'watchlist', 'watching', 'watched', 'planned', 'dropped']
const STATUS_LABELS = { all: 'Alle', watchlist: 'Watchlist', watching: 'Schaue ich', watched: 'Gesehen', planned: 'Geplant', dropped: 'Abgebr.' }

export default function FriendWatchlist() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [watchlists, setWatchlists] = useState([])
  const [activeWl, setActiveWl] = useState(null)
  const [movies, setMovies] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showWlPicker, setShowWlPicker] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterRating, setFilterRating] = useState(null)
  const [filterTag, setFilterTag] = useState(null)
  const [filterType, setFilterType] = useState(null)
  const [sortBy, setSortBy] = useState('newest')

  useEffect(() => {
    fetchWatchlists()
  }, [username])

  useEffect(() => {
    fetchMovies()
  }, [username, activeWl])

  const fetchWatchlists = async () => {
    try {
      const res = await api.get(`/watchlist/user/${username}/lists`)
      setWatchlists(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Laden')
    }
  }

  const fetchMovies = async () => {
    setLoading(true)
    try {
      const params = activeWl ? { watchlist_id: activeWl } : {}
      const res = await api.get(`/watchlist/user/${username}/movies`, { params })
      setMovies(res.data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  const activeWatchlist = watchlists.find(w => w.id === activeWl)

  const allTags = [...new Map(
    movies.flatMap(m => (m.tags || []))
      .map(t => [t.label, t])
  ).values()]

  const hasActiveFilters = filterRating || filterTag || filterType || sortBy !== 'newest'

  const filtered = movies
    .filter(m => {
      if (status !== 'all' && m.status !== status) return false
      if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false
      if (filterRating && (m.rating || 0) < filterRating) return false
      if (filterTag && !(m.tags || []).some(t => t.label === filterTag)) return false
      if (filterType && m.media_type !== filterType) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at) - new Date(b.created_at)
        case 'rating': return (b.rating || 0) - (a.rating || 0)
        case 'title': return a.title.localeCompare(b.title)
        case 'tmdb': return (b.vote_average || 0) - (a.vote_average || 0)
        default: return new Date(b.created_at) - new Date(a.created_at)
      }
    })

  const clearFilters = () => {
    setFilterRating(null)
    setFilterTag(null)
    setFilterType(null)
    setSortBy('newest')
  }

  const VISIBILITY_LABELS = { friends: '👥 Freunde', private: '🔒 Privat' }

  if (error && watchlists.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="glass-button p-2">
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{username}</h1>
        </div>
        <div className="glass p-6 text-center text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with back button + watchlist picker */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="glass-button p-2 shrink-0">
          <HiArrowLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowWlPicker(!showWlPicker)}
          className="flex items-center gap-2 text-left min-w-0 flex-1"
        >
          <span className="text-2xl">{activeWatchlist?.icon || '📋'}</span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate flex items-center gap-1.5">
              {activeWatchlist?.name || `${username}s Watchlists`}
              <HiChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${showWlPicker ? 'rotate-180' : ''}`} />
            </h1>
            <p className="text-xs text-white/40">
              {activeWl
                ? `${movies.length} Titel · ${VISIBILITY_LABELS[activeWatchlist?.visibility] || ''}`
                : `${watchlists.length} Listen · ${movies.length} Titel`
              }
            </p>
          </div>
        </button>
      </div>

      {/* Watchlist Picker Dropdown */}
      {showWlPicker && (
        <div className="overflow-hidden">
          <div className="glass p-2 space-y-1">
            <button
              onClick={() => { setActiveWl(null); setShowWlPicker(false) }}
              className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                !activeWl ? 'bg-primary-500/15 border border-primary-400/20' : 'hover:bg-white/[0.04] active:bg-white/[0.06]'
              }`}
            >
              <span className="text-xl">📋</span>
              <div className="text-left flex-1 min-w-0">
                <p className="font-medium text-sm">Alle Watchlists</p>
                <p className="text-[11px] text-white/30">Alle sichtbaren Filme</p>
              </div>
            </button>

            {watchlists.map(wl => (
              <button
                key={wl.id}
                onClick={() => { setActiveWl(wl.id); setShowWlPicker(false) }}
                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                  activeWl === wl.id ? 'bg-primary-500/15 border border-primary-400/20' : 'hover:bg-white/[0.04] active:bg-white/[0.06]'
                }`}
              >
                <span className="text-xl">{wl.icon}</span>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{wl.name}</p>
                  <p className="text-[11px] text-white/30">
                    {wl.movie_count} Titel · {VISIBILITY_LABELS[wl.visibility] || wl.visibility}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter toggle */}
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Film suchen..." />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`shrink-0 w-12 rounded-xl flex items-center justify-center transition-all ${
            hasActiveFilters
              ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
              : 'bg-white/[0.06] border border-white/[0.1] text-white/40'
          }`}
        >
          <HiAdjustmentsHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="glass p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filter & Sortierung</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-primary-400 active:opacity-70">
                Zurücksetzen
              </button>
            )}
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Sortierung</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[
                { v: 'newest', l: 'Neueste' },
                { v: 'oldest', l: 'Älteste' },
                { v: 'rating', l: 'Rating' },
                { v: 'tmdb', l: 'TMDB Rating' },
                { v: 'title', l: 'A-Z' },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setSortBy(v)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    sortBy === v
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                      : 'bg-white/[0.04] text-white/40'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Typ</label>
            <div className="flex gap-2">
              {[
                { v: null, l: 'Alle' },
                { v: 'movie', l: '🎬 Filme' },
                { v: 'tv', l: '📺 Serien' },
              ].map(({ v, l }) => (
                <button
                  key={String(v)}
                  onClick={() => setFilterType(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    filterType === v
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                      : 'bg-white/[0.04] text-white/40'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Tag</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterTag(null)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                    !filterTag
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                      : 'bg-white/[0.04] text-white/40'
                  }`}
                >
                  Alle
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag.label}
                    onClick={() => setFilterTag(filterTag === tag.label ? null : tag.label)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                      filterTag === tag.label ? 'ring-1 ring-white/30' : ''
                    }`}
                    style={{
                      backgroundColor: `${tag.color}${filterTag === tag.label ? '30' : '15'}`,
                      color: tag.color,
                    }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 ${
              status === s
                ? 'bg-white/[0.10] text-white border border-white/[0.15]'
                : 'bg-white/[0.03] border border-white/[0.06] text-white/40 active:bg-white/[0.06]'
            }`}
            style={status === s ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 12px rgba(99,102,241,0.08)' } : {}}
          >
            {STATUS_LABELS[s]}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                {movies.filter(m => m.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results info */}
      {hasActiveFilters && !loading && (
        <p className="text-xs text-white/30">
          {filtered.length} von {movies.length} Titeln
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-lg">Keine Filme gefunden</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(movie => (
            <MovieCard key={movie.id} movie={movie} onClick={setSelectedMovie} />
          ))}
        </div>
      )}

      <MovieDetailModal
        movie={selectedMovie}
        open={!!selectedMovie}
        onClose={() => setSelectedMovie(null)}
        readonly
      />
    </div>
  )
}
