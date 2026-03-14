import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiPlus, HiCheck, HiStar, HiMagnifyingGlass } from 'react-icons/hi2'
import api from '../api/client'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

export default function Discover() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [trending, setTrending] = useState([])
  const [addedIds, setAddedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('trending')

  useEffect(() => {
    api.get('/media/trending').then(res => setTrending(res.data.results || [])).catch(() => {})
    // Load existing watchlist tmdb_ids
    api.get('/watchlist/movies').then(res => {
      setAddedIds(new Set(res.data.map(m => `${m.tmdb_id}-${m.media_type}`)))
    }).catch(() => {})
  }, [])

  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await api.get('/media/search', { params: { q: query } })
      setResults(res.data.results || [])
      setTab('search')
    } catch {} finally {
      setLoading(false)
    }
  }, [query])

  const addToWatchlist = async (item) => {
    const key = `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`
    if (addedIds.has(key)) return

    try {
      await api.post('/watchlist/movies', {
        title: item.title || item.name,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        poster_url: item.poster_path,
        backdrop_path: item.backdrop_path,
        overview: item.overview,
        tmdb_id: item.id,
        media_type: item.media_type || (item.title ? 'movie' : 'tv'),
        vote_average: item.vote_average,
        genres: item.genre_ids,
      })
      setAddedIds(prev => new Set([...prev, key]))
    } catch {}
  }

  const items = tab === 'search' ? results : trending

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Entdecken</h1>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); search() }} className="flex gap-2">
        <div className="relative flex-1">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Film oder Serie suchen..."
            className="glass-input pl-10"
          />
        </div>
        <button type="submit" className="btn-primary px-4" disabled={loading}>
          {loading ? '...' : 'Suchen'}
        </button>
      </form>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('trending')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'trending' ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'glass-light text-white/50'
          }`}
        >
          Trending
        </button>
        {results.length > 0 && (
          <button
            onClick={() => setTab('search')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'search' ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'glass-light text-white/50'
            }`}
          >
            Ergebnisse ({results.length})
          </button>
        )}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <AnimatePresence>
          {items.filter(i => i.media_type !== 'person').map((item) => {
            const key = `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`
            const isAdded = addedIds.has(key)

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="movie-card group"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {/* Type badge */}
                  <div className="absolute top-2 left-2 glass-light px-2 py-0.5 rounded-lg">
                    <span className="text-[10px] font-medium uppercase">
                      {item.media_type === 'tv' ? 'Serie' : 'Film'}
                    </span>
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => addToWatchlist(item)}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isAdded
                        ? 'bg-green-500 text-white'
                        : 'glass-light hover:bg-primary-500/30 text-white/70 hover:text-white'
                    }`}
                  >
                    {isAdded ? <HiCheck className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
                  </button>

                  {/* Rating */}
                  {item.vote_average > 0 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 glass-light px-1.5 py-0.5 rounded-lg">
                      <HiStar className="w-3 h-3 text-amber-400" />
                      <span className="text-xs font-medium">{item.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{item.title || item.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {(item.release_date || item.first_air_date || '').slice(0, 4)}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
