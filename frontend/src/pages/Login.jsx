import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [plexLoading, setPlexLoading] = useState(false)
  const [showLocal, setShowLocal] = useState(false)
  const [showJellyfin, setShowJellyfin] = useState(false)
  const [jfLoading, setJfLoading] = useState(false)
  const [jfUsername, setJfUsername] = useState('')
  const [jfPassword, setJfPassword] = useState('')
  const [loginOptions, setLoginOptions] = useState({ plex: true, jellyfin: false, jellyfin_url: null })
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/auth/login-options').then(r => setLoginOptions(r.data)).catch(() => {})
  }, [])

  const loginWithJellyfin = async () => {
    if (!jfUsername || !jfPassword) return
    setJfLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/jellyfin/login', {
        url: loginOptions.jellyfin_url,
        username: jfUsername,
        password: jfPassword,
      })
      localStorage.setItem('token', res.data.access_token)
      window.location.href = '/'
    } catch (e) {
      setError(e.response?.data?.detail || 'Jellyfin Login fehlgeschlagen')
    }
    setJfLoading(false)
  }

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

  const loginWithPlex = async () => {
    setPlexLoading(true)
    setError('')

    // Open window FIRST (must be in direct click handler, before any await)
    const authWindow = window.open('about:blank', 'plex_auth', 'width=800,height=600')

    try {
      // Step 1: Get PIN
      const pinRes = await api.post('/auth/plex/pin')
      const { pin_id, auth_url } = pinRes.data

      // Step 2: Navigate the already-open window to Plex auth
      if (authWindow) {
        authWindow.location.href = auth_url
      } else {
        // Popup was blocked - fallback to same-tab redirect
        setPlexLoading(false)
        setError('Popup wurde blockiert. Bitte Popup-Blocker deaktivieren oder:')
        window.location.href = auth_url
        return
      }

      // Step 3: Poll for completion
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        if (attempts > 120) {
          clearInterval(poll)
          setPlexLoading(false)
          setError('Zeitüberschreitung — bitte erneut versuchen')
          return
        }
        try {
          const callbackRes = await api.post('/auth/plex/callback', { pin_id })
          if (callbackRes.data.status === 'waiting') {
            // Still waiting for user to authorize
            return
          }
          // Success - got access_token
          clearInterval(poll)
          if (authWindow && !authWindow.closed) authWindow.close()
          localStorage.setItem('token', callbackRes.data.access_token)
          window.location.href = '/'
        } catch (e) {
          clearInterval(poll)
          setPlexLoading(false)
          setError(e.response?.data?.detail || 'Plex Login fehlgeschlagen')
        }
      }, 2000)

      // Also stop if window is closed
      const windowCheck = setInterval(() => {
        if (authWindow && authWindow.closed) {
          clearInterval(windowCheck)
          // Give it a few more seconds in case auth completed
          setTimeout(() => {
            setPlexLoading(false)
          }, 3000)
        }
      }, 500)

    } catch (e) {
      setPlexLoading(false)
      setError(e.response?.data?.detail || 'Plex Login konnte nicht gestartet werden')
    }
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center p-4 relative overflow-auto">
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Plex Login - primary */}
        <button
          onClick={loginWithPlex}
          disabled={plexLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl text-sm font-semibold bg-[#e5a00d] text-black active:bg-[#c98c0b] transition-all disabled:opacity-50 mb-4"
        >
          {plexLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Warte auf Plex...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm0 2.5L20 7.5v9L12 21.5 4 16.5v-9L12 2.5z"/>
                <path d="M12 5L6 8.5v7L12 19l6-3.5v-7L12 5z"/>
              </svg>
              Mit Plex anmelden
            </>
          )}
        </button>

        {/* Jellyfin Login */}
        {loginOptions.jellyfin && !showJellyfin && (
          <button
            onClick={() => setShowJellyfin(true)}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold bg-[#6B4FA0] text-white active:bg-[#5A3F8A] transition-all mb-2"
          >
            <span className="text-lg">🟣</span>
            Mit Jellyfin anmelden
          </button>
        )}

        {showJellyfin && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 mb-4">
            <input value={jfUsername} onChange={e => setJfUsername(e.target.value)} placeholder="Jellyfin Benutzername" className="glass-input" autoComplete="username" />
            <input type="password" value={jfPassword} onChange={e => setJfPassword(e.target.value)} placeholder="Jellyfin Passwort" className="glass-input" autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && loginWithJellyfin()} />
            <div className="flex gap-2">
              <button onClick={() => setShowJellyfin(false)} className="flex-1 py-2.5 rounded-xl text-xs bg-white/[0.06] text-white/50">Abbrechen</button>
              <button onClick={loginWithJellyfin} disabled={jfLoading || !jfUsername || !jfPassword}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#6B4FA0] text-white disabled:opacity-50">
                {jfLoading ? 'Anmelden...' : 'Anmelden'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <button
            onClick={() => setShowLocal(!showLocal)}
            className="text-[11px] text-white/20 active:text-white/40"
          >
            {showLocal ? 'Ausblenden' : 'Lokaler Login'}
          </button>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Local login - secondary */}
        {showLocal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <form onSubmit={handleSubmit} className="space-y-3">
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

            <p className="text-center text-white/15 text-[10px] mt-3">Nur für Notfall-Zugang</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
