import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HiPlus, HiPencil, HiTrash, HiShare, HiChevronDown, HiUserPlus, HiXMark } from 'react-icons/hi2'
import api from '../api/client'
import MovieCard from '../components/MovieCard'
import MovieDetailModal from '../components/MovieDetailModal'
import SearchBar from '../components/SearchBar'
import Modal from '../components/Modal'

const STATUSES = ['all', 'watchlist', 'watched', 'planned', 'dropped']
const ICONS = ['🎬', '❤️', '👻', '🍿', '🎭', '🌟', '🔥', '📺', '🎮', '👨‍👩‍👧‍👦', '🏠', '😂', '🎄', '🌙']

export default function Watchlist() {
  const [watchlists, setWatchlists] = useState([])
  const [activeWl, setActiveWl] = useState(null) // null = all
  const [movies, setMovies] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showWlPicker, setShowWlPicker] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [showShare, setShowShare] = useState(null)
  const [newWl, setNewWl] = useState({ name: '', icon: '🎬', visibility: 'friends' })
  const [shareUsername, setShareUsername] = useState('')
  const [sharePermission, setSharePermission] = useState('view')

  useEffect(() => {
    fetchWatchlists()
  }, [])

  useEffect(() => {
    fetchMovies()
  }, [activeWl])

  const fetchWatchlists = async () => {
    try {
      const res = await api.get('/watchlist/lists')
      setWatchlists(res.data)
    } catch {}
  }

  const fetchMovies = async () => {
    setLoading(true)
    try {
      const params = activeWl ? { watchlist_id: activeWl } : {}
      const res = await api.get('/watchlist/movies', { params })
      setMovies(res.data)

      // Auto-enrich movies missing poster/metadata from TMDB
      const toEnrich = res.data.filter(m => m.tmdb_id && !m.poster_url)
      for (const movie of toEnrich) {
        try {
          const enriched = await api.post(`/watchlist/movies/${movie.id}/enrich`)
          setMovies(prev => prev.map(m => m.id === movie.id ? enriched.data : m))
        } catch {}
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id, data) => {
    try {
      const res = await api.put(`/watchlist/movies/${id}`, data)
      setMovies(prev => prev.map(m => m.id === id ? res.data : m))
      if (selectedMovie?.id === id) setSelectedMovie(res.data)
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/watchlist/movies/${id}`)
      setMovies(prev => prev.filter(m => m.id !== id))
      setSelectedMovie(null)
      fetchWatchlists() // Update counts
    } catch {}
  }

  const createWatchlist = async (e) => {
    e.preventDefault()
    if (!newWl.name.trim()) return
    try {
      await api.post('/watchlist/lists', newWl)
      setNewWl({ name: '', icon: '🎬', visibility: 'friends' })
      setShowCreate(false)
      fetchWatchlists()
    } catch {}
  }

  const updateWatchlist = async () => {
    if (!showEdit) return
    try {
      await api.put(`/watchlist/lists/${showEdit.id}`, {
        name: showEdit.name,
        icon: showEdit.icon,
        visibility: showEdit.visibility,
      })
      setShowEdit(null)
      fetchWatchlists()
    } catch {}
  }

  const deleteWatchlist = async (id) => {
    try {
      await api.delete(`/watchlist/lists/${id}`)
      if (activeWl === id) setActiveWl(null)
      setShowEdit(null)
      fetchWatchlists()
      fetchMovies()
    } catch {}
  }

  const shareWatchlist = async (e) => {
    e.preventDefault()
    if (!shareUsername.trim() || !showShare) return
    try {
      await api.post(`/watchlist/lists/${showShare}/share`, {
        username: shareUsername,
        permission: sharePermission,
      })
      setShareUsername('')
      setShowShare(null)
      fetchWatchlists()
    } catch {}
  }

  const unshare = async (wlId, userId) => {
    try {
      await api.delete(`/watchlist/lists/${wlId}/share/${userId}`)
      fetchWatchlists()
    } catch {}
  }

  const activeWatchlist = watchlists.find(w => w.id === activeWl)
  const filtered = movies.filter(m => {
    if (status !== 'all' && m.status !== status) return false
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Watchlist Selector */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setShowWlPicker(!showWlPicker)}
          className="flex items-center gap-2 text-left min-w-0"
        >
          <span className="text-2xl">{activeWatchlist?.icon || '📋'}</span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate flex items-center gap-1.5">
              {activeWatchlist?.name || 'Alle Watchlists'}
              <HiChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${showWlPicker ? 'rotate-180' : ''}`} />
            </h1>
            <p className="text-xs text-white/40">
              {activeWl ? `${movies.length} Filme` : `${watchlists.length} Listen`}
            </p>
          </div>
        </button>

        <div className="flex gap-2 shrink-0">
          {activeWl && activeWatchlist?.owner_username && (
            <>
              <button onClick={() => setShowShare(activeWl)} className="glass-button p-2 rounded-lg">
                <HiShare className="w-4 h-4" />
              </button>
              <button onClick={() => setShowEdit({...activeWatchlist})} className="glass-button p-2 rounded-lg">
                <HiPencil className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => setShowCreate(true)} className="btn-primary p-2 rounded-lg">
            <HiPlus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Watchlist Picker Dropdown */}
      <AnimatePresence>
        {showWlPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
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
                  <p className="text-[11px] text-white/30">Alle Filme aus allen Listen</p>
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
                    <p className="font-medium text-sm truncate">
                      {wl.name}
                      {wl.shared_with?.length > 0 && (
                        <span className="ml-1.5 text-[10px] text-primary-400/60">
                          ({wl.shared_with.length} geteilt)
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/30">
                      {wl.movie_count} Filme
                      {wl.owner_username && wl.owner_id !== (watchlists.find(w => w.is_default)?.owner_id) ? ` · von ${wl.owner_username}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchBar value={search} onChange={setSearch} placeholder="Film suchen..." />

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              status === s
                ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                : 'bg-white/[0.04] border border-white/[0.06] text-white/50 active:bg-white/[0.08]'
            }`}
          >
            {s === 'all' ? 'Alle' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                {movies.filter(m => m.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-lg">Keine Filme gefunden</p>
          <p className="text-sm mt-1">Füge Filme über "Entdecken" hinzu</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <AnimatePresence>
            {filtered.map(movie => (
              <MovieCard key={movie.id} movie={movie} onClick={setSelectedMovie} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Modal */}
      <MovieDetailModal
        movie={selectedMovie}
        open={!!selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Create Watchlist Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Neue Watchlist">
        <form onSubmit={createWatchlist} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setNewWl({...newWl, icon})}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                    newWl.icon === icon ? 'bg-primary-500/20 border border-primary-400/30 scale-110' : 'bg-white/[0.04] active:scale-95'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={newWl.name}
            onChange={(e) => setNewWl({...newWl, name: e.target.value})}
            placeholder="Name der Watchlist"
            className="glass-input"
            required
          />
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Sichtbarkeit</label>
            <div className="grid grid-cols-3 gap-2">
              {['public', 'friends', 'private'].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNewWl({...newWl, visibility: v})}
                  className={`py-2 rounded-xl text-xs font-medium transition-all ${
                    newWl.visibility === v ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'bg-white/[0.04] text-white/50'
                  }`}
                >
                  {v === 'public' ? '🌍 Öffentlich' : v === 'friends' ? '👥 Freunde' : '🔒 Privat'}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">Erstellen</button>
        </form>
      </Modal>

      {/* Edit Watchlist Modal */}
      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title="Watchlist bearbeiten">
        {showEdit && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setShowEdit({...showEdit, icon})}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                      showEdit.icon === icon ? 'bg-primary-500/20 border border-primary-400/30 scale-110' : 'bg-white/[0.04]'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={showEdit.name}
              onChange={(e) => setShowEdit({...showEdit, name: e.target.value})}
              className="glass-input"
            />
            <div className="grid grid-cols-3 gap-2">
              {['public', 'friends', 'private'].map(v => (
                <button
                  key={v}
                  onClick={() => setShowEdit({...showEdit, visibility: v})}
                  className={`py-2 rounded-xl text-xs font-medium transition-all ${
                    showEdit.visibility === v ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'bg-white/[0.04] text-white/50'
                  }`}
                >
                  {v === 'public' ? '🌍 Öffentlich' : v === 'friends' ? '👥 Freunde' : '🔒 Privat'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={updateWatchlist} className="btn-primary flex-1">Speichern</button>
              {!showEdit.is_default && (
                <button onClick={() => deleteWatchlist(showEdit.id)} className="btn-danger px-4">
                  <HiTrash className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Share Modal */}
      <Modal open={!!showShare} onClose={() => setShowShare(null)} title="Watchlist teilen">
        <form onSubmit={shareWatchlist} className="space-y-4">
          <input
            type="text"
            value={shareUsername}
            onChange={(e) => setShareUsername(e.target.value)}
            placeholder="Benutzername"
            className="glass-input"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSharePermission('view')}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                sharePermission === 'view' ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'bg-white/[0.04] text-white/50'
              }`}
            >
              👁 Nur ansehen
            </button>
            <button
              type="button"
              onClick={() => setSharePermission('edit')}
              className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                sharePermission === 'edit' ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30' : 'bg-white/[0.04] text-white/50'
              }`}
            >
              ✏️ Bearbeiten
            </button>
          </div>
          <button type="submit" className="btn-primary w-full">
            <HiUserPlus className="w-4 h-4 inline mr-2" />Teilen
          </button>
        </form>

        {/* Current shares */}
        {showShare && (() => {
          const wl = watchlists.find(w => w.id === showShare)
          if (!wl?.shared_with?.length) return null
          return (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Geteilt mit</p>
              <div className="space-y-2">
                {wl.shared_with.map(s => (
                  <div key={s.user_id} className="flex items-center justify-between bg-white/[0.04] p-3 rounded-xl">
                    <div>
                      <span className="font-medium text-sm">{s.username}</span>
                      <span className="text-xs text-white/30 ml-2">{s.permission === 'edit' ? '✏️ Bearbeiten' : '👁 Ansehen'}</span>
                    </div>
                    <button onClick={() => unshare(showShare, s.user_id)} className="text-red-400 p-1">
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
