import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import api from '../api/client'
import MovieCard from '../components/MovieCard'
import MovieDetailModal from '../components/MovieDetailModal'
import SearchBar from '../components/SearchBar'

const STATUSES = ['all', 'watchlist', 'watched', 'planned', 'dropped']

export default function Watchlist() {
  const [movies, setMovies] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedMovie, setSelectedMovie] = useState(null)
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
      // Update selected movie if it's the one being edited
      if (selectedMovie?.id === id) {
        setSelectedMovie(res.data)
      }
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/watchlist/movies/${id}`)
      setMovies(prev => prev.filter(m => m.id !== id))
      setSelectedMovie(null)
    } catch {}
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
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-4xl mb-3">🎬</p>
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
                onClick={setSelectedMovie}
              />
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
    </div>
  )
}
