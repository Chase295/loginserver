import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft } from 'react-icons/hi2'
import { AnimatePresence } from 'framer-motion'
import api from '../api/client'
import MovieCard from '../components/MovieCard'
import SearchBar from '../components/SearchBar'

export default function FriendWatchlist() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [movies, setMovies] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/watchlist/user/${username}`)
      .then(res => setMovies(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [username])

  const filtered = movies.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="glass-button p-2">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{username}</h1>
          <p className="text-sm text-white/40">{movies.length} Filme</p>
        </div>
      </div>

      {error ? (
        <div className="glass p-6 text-center text-red-400">{error}</div>
      ) : (
        <>
          <SearchBar value={search} onChange={setSearch} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <AnimatePresence>
              {filtered.map(movie => (
                <MovieCard key={movie.id} movie={movie} readonly />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}
