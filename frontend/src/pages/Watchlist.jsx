import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HiAdjustmentsHorizontal } from 'react-icons/hi2'
import api from '../api/client'
import MovieCard from '../components/MovieCard'
import SearchBar from '../components/SearchBar'
import Modal from '../components/Modal'

const STATUSES = ['all', 'watchlist', 'watched', 'planned', 'dropped']

export default function Watchlist() {
  const [movies, setMovies] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [editMovie, setEditMovie] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMovies()
  }, [])

  const fetchMovies = async () => {
    try {
      const res = await api.get('/watchlist/movies')
      setMovies(res.data)
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id, data) => {
    try {
      const res = await api.put(`/watchlist/movies/${id}`, data)
      setMovies(prev => prev.map(m => m.id === id ? res.data : m))
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/watchlist/movies/${id}`)
      setMovies(prev => prev.filter(m => m.id !== id))
    } catch {}
  }

  const handleEditSave = async () => {
    if (!editMovie) return
    await handleUpdate(editMovie.id, {
      status: editMovie.status,
      rating: editMovie.rating,
      notes: editMovie.notes,
      is_private: editMovie.is_private,
      tags: editMovie.tags,
    })
    setEditMovie(null)
  }

  const filtered = movies.filter(m => {
    if (status !== 'all' && m.status !== status) return false
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meine Watchlist</h1>

      {/* Search & Filter */}
      <SearchBar value={search} onChange={setSearch} placeholder="Film suchen..." />

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              status === s
                ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                : 'glass-light text-white/50 hover:text-white/80'
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
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-lg">Keine Filme gefunden</p>
          <p className="text-sm mt-1">Füge Filme über "Entdecken" hinzu</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <AnimatePresence>
            {filtered.map(movie => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onEdit={setEditMovie}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editMovie} onClose={() => setEditMovie(null)} title="Film bearbeiten">
        {editMovie && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/50 mb-1 block">Status</label>
              <select
                value={editMovie.status}
                onChange={(e) => setEditMovie({ ...editMovie, status: e.target.value })}
                className="glass-input"
              >
                <option value="watchlist">Watchlist</option>
                <option value="watched">Watched</option>
                <option value="planned">Planned</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-white/50 mb-1 block">Bewertung</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => setEditMovie({ ...editMovie, rating: r })}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                      editMovie.rating >= r
                        ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                        : 'glass-light text-white/30'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-white/50 mb-1 block">Notizen</label>
              <textarea
                value={editMovie.notes || ''}
                onChange={(e) => setEditMovie({ ...editMovie, notes: e.target.value })}
                className="glass-input min-h-[80px] resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editMovie.is_private}
                  onChange={(e) => setEditMovie({ ...editMovie, is_private: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-primary-500/50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
              </label>
              <span className="text-sm text-white/60">Privat</span>
            </div>
            <button onClick={handleEditSave} className="btn-primary w-full">Speichern</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
