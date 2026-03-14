import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Ungültige Anmeldedaten')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary-500/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-sm p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <span className="text-2xl font-bold">W</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Watchlist</h1>
          <p className="text-white/40 text-sm mt-1">Anmelden</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Benutzername"
            className="glass-input"
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort"
            className="glass-input"
            required
            autoComplete="current-password"
          />

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Laden...
              </span>
            ) : 'Anmelden'}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          Kein Account?{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 transition-colors">
            Registrieren
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
