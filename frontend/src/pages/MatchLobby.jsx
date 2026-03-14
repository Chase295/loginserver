import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiArrowLeft, HiHandThumbUp, HiHandThumbDown } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

export default function MatchLobby() {
  const { matchId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [pool, setPool] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [matches, setMatches] = useState([])
  const [phase, setPhase] = useState('lobby') // lobby, playing, results

  useEffect(() => {
    fetchMatch()
  }, [matchId])

  const fetchMatch = async () => {
    try {
      const res = await api.get(`/match/${matchId}`)
      setMatch(res.data)
      if (res.data.status === 'playing') {
        setPhase('playing')
        const poolRes = await api.get(`/match/${matchId}/pool`)
        setPool(poolRes.data)
      } else if (res.data.status === 'finished') {
        setPhase('results')
        const matchesRes = await api.get(`/match/${matchId}/matches`)
        setMatches(matchesRes.data)
      }
    } catch {}
  }

  const setReady = async () => {
    try {
      const res = await api.post(`/match/${matchId}/ready`)
      if (res.data.both_ready) {
        await api.put(`/match/${matchId}/status`, { status: 'playing' })
        fetchMatch()
      }
    } catch {}
  }

  const vote = async (liked) => {
    const movie = pool[currentIdx]
    if (!movie) return
    try {
      await api.post(`/match/${matchId}/like`, { movie_id: movie.movie.id, liked })
      if (currentIdx + 1 >= pool.length) {
        const res = await api.get(`/match/${matchId}/matches`)
        setMatches(res.data)
        setPhase('results')
        await api.put(`/match/${matchId}/status`, { status: 'finished' })
      } else {
        setCurrentIdx(prev => prev + 1)
      }
    } catch {}
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="glass-button p-2">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">
          {match.player1_username} vs {match.player2_username}
        </h1>
      </div>

      {/* Lobby */}
      {phase === 'lobby' && (
        <div className="glass p-8 text-center space-y-6">
          <div className="text-6xl">🎬</div>
          <p className="text-white/50">Wartet auf beide Spieler...</p>
          <button onClick={setReady} className="btn-primary">
            Bereit!
          </button>
        </div>
      )}

      {/* Playing - Swipe cards */}
      {phase === 'playing' && pool[currentIdx] && (
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass overflow-hidden"
        >
          <div className="relative aspect-[2/3] max-h-[50vh]">
            {pool[currentIdx].movie.poster_url ? (
              <img
                src={`${TMDB_IMG}/w500${pool[currentIdx].movie.poster_url}`}
                alt={pool[currentIdx].movie.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-900 to-purple-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <h2 className="text-xl font-bold">{pool[currentIdx].movie.title}</h2>
            </div>
          </div>

          <div className="p-4 flex justify-center gap-6">
            <button
              onClick={() => vote(false)}
              className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all active:scale-90"
            >
              <HiHandThumbDown className="w-8 h-8" />
            </button>
            <button
              onClick={() => vote(true)}
              className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/30 transition-all active:scale-90"
            >
              <HiHandThumbUp className="w-8 h-8" />
            </button>
          </div>

          <div className="px-4 pb-4">
            <div className="w-full bg-white/10 rounded-full h-1">
              <div
                className="bg-primary-500 h-1 rounded-full transition-all"
                style={{ width: `${((currentIdx + 1) / pool.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-white/30 text-center mt-2">
              {currentIdx + 1} / {pool.length}
            </p>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {phase === 'results' && (
        <div className="space-y-4">
          <div className="glass p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-bold gradient-text">
              {matches.length} {matches.length === 1 ? 'Match' : 'Matches'}!
            </h2>
          </div>

          {matches.map(movie => (
            <div key={movie.id} className="glass p-4 flex items-center gap-4">
              {movie.poster_url && (
                <img
                  src={`${TMDB_IMG}/w92${movie.poster_url}`}
                  alt={movie.title}
                  className="w-16 h-24 object-cover rounded-lg"
                />
              )}
              <div>
                <p className="font-semibold">{movie.title}</p>
              </div>
            </div>
          ))}

          {matches.length === 0 && (
            <p className="text-center text-white/30 py-4">Keine gemeinsamen Filme gefunden</p>
          )}
        </div>
      )}
    </div>
  )
}
