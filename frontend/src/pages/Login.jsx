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
      {/* Ambient orbs — more diffused for liquid feel */}
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
          <p className="text-white/30 text-sm mt-1">Anmelden</p>
        </div>

        {error && (
          <div className="bg-red-500/8 border border-red-500/15 rounded-2xl px-4 py-2.5 text-sm text-red-400 mb-4"
               style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            {error}
          </div>
        )}

        {/* Plex Login - primary */}
        <button
          onClick={loginWithPlex}
          disabled={plexLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl text-sm font-semibold text-black active:scale-[0.97] transition-all duration-300 disabled:opacity-50 mb-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #e5a00d, #f0b429)',
            boxShadow: '0 4px 20px rgba(229,160,13,0.25), inset 0 1px 0 rgba(255,255,255,0.30)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent" style={{ height: '50%' }} />
          {plexLoading ? (
            <span className="relative flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Warte auf Plex...
            </span>
          ) : (
            <span className="relative flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm0 2.5L20 7.5v9L12 21.5 4 16.5v-9L12 2.5z"/>
                <path d="M12 5L6 8.5v7L12 19l6-3.5v-7L12 5z"/>
              </svg>
              Mit Plex anmelden
            </span>
          )}
        </button>

        {/* Jellyfin Login */}
        {loginOptions.jellyfin && !showJellyfin && (
          <button
            onClick={() => setShowJellyfin(true)}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl text-sm font-semibold text-white active:scale-[0.97] transition-all duration-300 mb-2 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(107,79,160,0.85), rgba(90,63,138,0.85))',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 20px rgba(107,79,160,0.20), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" style={{ height: '50%' }} />
            <span className="relative flex items-center gap-2">
              <span className="text-lg">🟣</span>
              Mit Jellyfin anmelden
            </span>
          </button>
        )}

        {showJellyfin && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2.5 mb-4">
            <input value={jfUsername} onChange={e => setJfUsername(e.target.value)} placeholder="Jellyfin Benutzername" className="glass-input" autoComplete="username" />
            <input type="password" value={jfPassword} onChange={e => setJfPassword(e.target.value)} placeholder="Jellyfin Passwort" className="glass-input" autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && loginWithJellyfin()} />
            <div className="flex gap-2">
              <button onClick={() => setShowJellyfin(false)} className="flex-1 py-2.5 rounded-2xl text-xs bg-white/[0.04] border border-white/[0.08] text-white/40 transition-all duration-200 active:scale-[0.97]">Abbrechen</button>
              <button onClick={loginWithJellyfin} disabled={jfLoading || !jfUsername || !jfPassword}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(107,79,160,0.85), rgba(90,63,138,0.85))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
                }}>
                {jfLoading ? 'Anmelden...' : 'Anmelden'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/[0.06]" />
          <button
            onClick={() => setShowLocal(!showLocal)}
            className="text-[11px] text-white/15 active:text-white/30 transition-colors duration-200"
          >
            {showLocal ? 'Ausblenden' : 'Lokaler Login'}
          </button>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/[0.06]" />
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

            <p className="text-center text-white/10 text-[10px] mt-3">Nur für Notfall-Zugang</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
