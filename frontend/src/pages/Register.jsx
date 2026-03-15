import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(username, email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center p-4 relative overflow-auto">
      {/* Ambient orbs */}
      <div className="absolute top-1/3 -left-20 w-80 h-80 bg-primary-500/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-purple-500/15 rounded-full blur-[120px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/8 rounded-full blur-[150px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass w-full max-w-sm p-8 relative"
      >
        {/* Top refraction highlight */}
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center relative"
               style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.30), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
            <span className="text-2xl font-bold">W</span>
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/15 to-transparent" style={{ height: '50%' }} />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Watchlist</h1>
          <p className="text-white/30 text-sm mt-1">Account erstellen</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="bg-red-500/8 border border-red-500/15 rounded-2xl px-4 py-2.5 text-sm text-red-400"
                 style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
              {error}
            </div>
          )}

          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="Benutzername" className="glass-input" required autoComplete="username" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail" className="glass-input" required autoComplete="email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort" className="glass-input" required minLength={6} autoComplete="new-password" />

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Laden...' : 'Registrieren'}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm mt-6">
          Schon einen Account?{' '}
          <Link to="/login" className="text-primary-300 hover:text-primary-200 transition-colors duration-200">
            Anmelden
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
