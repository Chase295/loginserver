import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiPlus, HiCheck, HiStar, HiMagnifyingGlass } from 'react-icons/hi2'
import api from '../api/client'
import Modal from '../components/Modal'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

export default function Discover() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [trending, setTrending] = useState([])
  const [addedIds, setAddedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('trending')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    api.get('/media/trending').then(res => setTrending(res.data.results || [])).catch(() => {})
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

  const openDetail = async (item) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv')
    setDetail({ ...item, media_type: mediaType })
    setDetailLoading(true)
    try {
      const res = await api.get(`/media/${mediaType}/${item.id}`)
      setDetail({ ...item, ...res.data, media_type: mediaType })
    } catch {} finally {
      setDetailLoading(false)
    }
  }

  const addToWatchlist = async (item) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv')
    const key = `${item.id}-${mediaType}`
    if (addedIds.has(key)) return

    try {
      await api.post('/watchlist/movies', {
        title: item.title || item.name,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        poster_url: item.poster_path,
        backdrop_path: item.backdrop_path,
        overview: item.overview,
        tmdb_id: item.id,
        media_type: mediaType,
        vote_average: item.vote_average,
        genres: item.genre_ids || item.genres?.map(g => g.id),
      })
      setAddedIds(prev => new Set([...prev, key]))
    } catch {}
  }

  const items = tab === 'search' ? results : trending
  const isAdded = (item) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv')
    return addedIds.has(`${item.id}-${mediaType}`)
  }

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
            tab === 'trending' ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'bg-white/[0.04] border border-white/[0.06] text-white/50'
          }`}
        >
          Trending
        </button>
        {results.length > 0 && (
          <button
            onClick={() => setTab('search')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'search' ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'bg-white/[0.04] border border-white/[0.06] text-white/50'
            }`}
          >
            Ergebnisse ({results.length})
          </button>
        )}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <AnimatePresence>
          {items.filter(i => i.media_type !== 'person').map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="movie-card"
              onClick={() => openDetail(item)}
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
                  <div className="w-full h-full bg-gradient-to-br from-primary-900 to-purple-900 flex items-center justify-center">
                    <span className="text-3xl opacity-20">🎬</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Type badge */}
                <div className="absolute top-2 left-2 bg-black/40 px-2 py-0.5 rounded-lg">
                  <span className="text-[10px] font-medium uppercase">
                    {(item.media_type || (item.title ? 'movie' : 'tv')) === 'tv' ? 'Serie' : 'Film'}
                  </span>
                </div>

                {/* Add Button - stop propagation so card click doesn't fire */}
                <button
                  onClick={(e) => { e.stopPropagation(); addToWatchlist(item) }}
                  className={`absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
                    isAdded(item)
                      ? 'bg-green-500 text-white'
                      : 'bg-black/40 text-white/80 active:bg-primary-500/50'
                  }`}
                >
                  {isAdded(item) ? <HiCheck className="w-4 h-4" /> : <HiPlus className="w-5 h-5" />}
                </button>

                {/* Rating */}
                {item.vote_average > 0 && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-lg">
                    <HiStar className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-medium">{item.vote_average.toFixed(1)}</span>
                  </div>
                )}
              </div>

              <div className="p-2.5">
                <h3 className="font-semibold text-sm truncate">{item.title || item.name}</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  {(item.release_date || item.first_air_date || '').slice(0, 4)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title || detail?.name || ''} large>
        {detail && (
          <div>
            {/* Backdrop */}
            {detail.backdrop_path && (
              <div className="relative -mx-5 -mt-4 mb-4 h-44 md:h-56 overflow-hidden rounded-t-lg">
                <img src={`${TMDB_IMG}/w780${detail.backdrop_path}`} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12122e] via-[#12122e]/60 to-transparent" />
              </div>
            )}

            <div className="flex gap-4 mb-4">
              {detail.poster_path && (
                <div className="shrink-0 w-28 rounded-xl overflow-hidden shadow-xl shadow-black/40 -mt-16 relative z-10 border border-white/10">
                  <img src={`${TMDB_IMG}/w342${detail.poster_path}`} alt="" className="w-full aspect-[2/3] object-cover" />
                </div>
              )}
              <div className="pt-1 flex-1 min-w-0">
                <h3 className="text-xl font-bold leading-tight">{detail.title || detail.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-white/50">
                  {(detail.release_date || detail.first_air_date) && (
                    <span>{(detail.release_date || detail.first_air_date).slice(0, 4)}</span>
                  )}
                  {detail.runtime && <span>{detail.runtime} min</span>}
                  {detail.vote_average > 0 && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <HiStar className="w-3.5 h-3.5" /> {detail.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
                {/* Genres */}
                {detail.genres && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {detail.genres.map(g => (
                      <span key={g.id} className="px-2 py-0.5 rounded-lg bg-white/[0.06] text-[11px] text-white/50">
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Overview */}
            {detail.overview && (
              <p className="text-sm text-white/60 leading-relaxed mb-4">{detail.overview}</p>
            )}

            {/* Cast */}
            {detail.credits?.cast?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Besetzung</h4>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {detail.credits.cast.slice(0, 10).map(person => (
                    <div key={person.id} className="shrink-0 w-16 text-center">
                      {person.profile_path ? (
                        <img src={`${TMDB_IMG}/w185${person.profile_path}`} alt={person.name}
                          className="w-14 h-14 rounded-full object-cover mx-auto mb-1 border border-white/10" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white/[0.06] mx-auto mb-1 flex items-center justify-center text-lg">👤</div>
                      )}
                      <p className="text-[10px] text-white/60 truncate">{person.name}</p>
                      <p className="text-[9px] text-white/30 truncate">{person.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add button */}
            <button
              onClick={() => { addToWatchlist(detail); }}
              disabled={isAdded(detail)}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] ${
                isAdded(detail)
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'btn-primary'
              }`}
            >
              {isAdded(detail) ? (
                <><HiCheck className="w-4 h-4 inline mr-2" />In deiner Watchlist</>
              ) : (
                <><HiPlus className="w-4 h-4 inline mr-2" />Zur Watchlist hinzufügen</>
              )}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
