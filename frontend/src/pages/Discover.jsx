import { useEffect, useState, useCallback } from 'react'

import { HiPlus, HiCheck, HiStar, HiMagnifyingGlass } from 'react-icons/hi2'
import api from '../api/client'
import Modal from '../components/Modal'
import WatchProviders from '../components/WatchProviders'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

// TMDB genre ID → name mapping
const GENRE_MAP = {
  28: 'Action', 12: 'Abenteuer', 16: 'Animation', 35: 'Komödie', 80: 'Krimi',
  99: 'Doku', 18: 'Drama', 10751: 'Familie', 14: 'Fantasy', 36: 'Historie',
  27: 'Horror', 10402: 'Musik', 9648: 'Mystery', 10749: 'Romantik', 878: 'Sci-Fi',
  10770: 'TV-Film', 53: 'Thriller', 10752: 'Krieg', 37: 'Western',
  // TV genres
  10759: 'Action & Abenteuer', 10762: 'Kinder', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'Krieg & Politik',
}

const GENRE_COLORS = {
  'Action': '#ef4444', 'Abenteuer': '#f59e0b', 'Animation': '#8b5cf6', 'Anime': '#ec4899',
  'Komödie': '#f59e0b', 'Krimi': '#6366f1', 'Doku': '#14b8a6', 'Drama': '#3b82f6',
  'Familie': '#10b981', 'Fantasy': '#a855f7', 'Horror': '#dc2626', 'Sci-Fi': '#06b6d4',
  'Thriller': '#64748b', 'Romantik': '#ec4899', 'Mystery': '#8b5cf6',
}

function buildAutoTags(item) {
  const genreIds = item.genre_ids || item.genres?.map(g => g.id) || []
  const tags = []

  // Detect Anime: Animation (16) + Japanese origin
  const isAnimation = genreIds.includes(16)
  const isJapanese = (item.origin_country || []).includes('JP') ||
    (item.original_language === 'ja')

  if (isAnimation && isJapanese) {
    tags.push({ label: 'Anime', color: GENRE_COLORS['Anime'] || '#ec4899', is_private: false })
  } else if (isAnimation) {
    tags.push({ label: 'Animation', color: GENRE_COLORS['Animation'] || '#8b5cf6', is_private: false })
  }

  // Add top 2 other genres (skip Animation if already handled)
  for (const id of genreIds) {
    if (tags.length >= 3) break
    if (id === 16) continue // skip Animation, handled above
    const name = GENRE_MAP[id]
    if (name && !tags.find(t => t.label === name)) {
      tags.push({ label: name, color: GENRE_COLORS[name] || '#6366f1', is_private: false })
    }
  }

  return tags
}

export default function Discover() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [trending, setTrending] = useState([])
  const [addedIds, setAddedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('trending')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [watchlists, setWatchlists] = useState([])
  const [selectedWl, setSelectedWl] = useState(null)
  const [addStatus, setAddStatus] = useState('watchlist')
  const [addRating, setAddRating] = useState(null)
  const [addNotes, setAddNotes] = useState('')

  useEffect(() => {
    api.get('/media/trending').then(res => setTrending(res.data.results || [])).catch(() => {})
    api.get('/watchlist/movies').then(res => {
      setAddedIds(new Set(res.data.map(m => `${m.tmdb_id}-${m.media_type}`)))
    }).catch(() => {})
    api.get('/watchlist/lists').then(res => {
      setWatchlists(res.data)
      const def = res.data.find(w => w.is_default)
      if (def) setSelectedWl(def.id)
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
    setAddStatus('watchlist')
    setAddRating(null)
    setAddNotes('')
    setDetailLoading(true)
    try {
      const res = await api.get(`/media/${mediaType}/${item.id}`)
      setDetail({ ...item, ...res.data, media_type: mediaType })
    } catch {} finally {
      setDetailLoading(false)
    }
  }

  const [skipAutoDownload, setSkipAutoDownload] = useState(false)

  const addToWatchlist = async (item, { status, rating, notes, skipAuto } = {}) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv')
    const key = `${item.id}-${mediaType}`
    if (addedIds.has(key)) return

    try {
      const params = { ...(selectedWl ? { watchlist_id: selectedWl } : {}), ...(skipAuto ? { skip_auto_download: true } : {}) }
      const autoTags = buildAutoTags(item)
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
        status: status || 'watchlist',
        rating: rating || null,
        notes: notes || null,
        tags: autoTags,
      }, { params })
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
          {items.filter(i => i.media_type !== 'person').map((item) => (
            <div
              key={item.id}
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
            </div>
          ))}
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

            {/* Streaming Providers */}
            {detail.id && (
              <div className="mb-4">
                <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Verfügbar auf</label>
                <WatchProviders mediaType={detail.media_type} tmdbId={detail.id} />
              </div>
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

            {!isAdded(detail) && (
              <div className="space-y-4 border-t border-white/[0.06] pt-4">
                {/* Status */}
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Status</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { v: 'watchlist', l: 'Watchlist', c: 'from-blue-500 to-cyan-400' },
                      { v: 'watching', l: 'Schaue ich', c: 'from-purple-500 to-violet-400' },
                      { v: 'watched', l: 'Gesehen', c: 'from-green-500 to-emerald-400' },
                      { v: 'planned', l: 'Geplant', c: 'from-amber-500 to-yellow-400' },
                      { v: 'dropped', l: 'Abgebr.', c: 'from-red-500 to-rose-400' },
                    ].map(({ v, l, c }) => (
                      <button
                        key={v}
                        onClick={() => setAddStatus(v)}
                        className={`py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                          addStatus === v
                            ? `bg-gradient-to-r ${c} text-white shadow-lg`
                            : 'bg-white/[0.06] text-white/40'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Bewertung</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(r => (
                      <button
                        key={r}
                        onClick={() => setAddRating(addRating === r ? null : r)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                          (addRating || 0) >= r
                            ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                            : 'bg-white/[0.06] text-white/20'
                        }`}
                      >
                        <HiStar className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Notizen</label>
                  <textarea
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="Optional: Notizen zum Film..."
                    className="glass-input min-h-[60px] resize-none text-sm"
                  />
                </div>

                {/* Watchlist Selector */}
                {watchlists.length > 1 && (
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Watchlist</label>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {watchlists.map(wl => (
                        <button
                          key={wl.id}
                          onClick={() => setSelectedWl(wl.id)}
                          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                            selectedWl === wl.id
                              ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                              : 'bg-white/[0.04] text-white/50 border border-white/[0.06]'
                          }`}
                        >
                          <span>{wl.icon}</span>
                          <span className="truncate max-w-[100px]">{wl.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skip auto-download toggle */}
                <label className="flex items-center gap-3 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={skipAutoDownload}
                    onChange={e => setSkipAutoDownload(e.target.checked)}
                    className="rounded border-white/20 bg-white/[0.06] w-4 h-4"
                  />
                  <span className="text-xs text-white/40">Nur merken — nicht automatisch installieren</span>
                </label>

                {/* Add Button */}
                <button
                  onClick={() => addToWatchlist(detail, { status: addStatus, rating: addRating, notes: addNotes, skipAuto: skipAutoDownload })}
                  className="btn-primary w-full active:scale-[0.97]"
                >
                  <HiPlus className="w-4 h-4 inline mr-2" />Hinzufügen
                </button>
              </div>
            )}

            {isAdded(detail) && (
              <div className="pt-4 border-t border-white/[0.06]">
                <div className="w-full py-3 rounded-xl text-sm font-semibold text-center bg-green-500/20 text-green-400 border border-green-500/30">
                  <HiCheck className="w-4 h-4 inline mr-2" />In deiner Watchlist
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
