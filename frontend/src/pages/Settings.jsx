import { useEffect, useState, useCallback } from 'react'
import { HiArrowRightOnRectangle, HiShieldCheck, HiUsers, HiArrowPath, HiCheck, HiXMark, HiLink, HiXCircle, HiPlus, HiTrash } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

function SyncOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fullSyncing, setFullSyncing] = useState(false)
  const [fullSyncResult, setFullSyncResult] = useState(null)

  useEffect(() => {
    api.get('/sync/overview')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || e.message || 'Fehler'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <section className="glass p-6">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        <span className="text-xs text-white/30">Lade Sync-Übersicht...</span>
      </div>
    </section>
  )

  if (error) return (
    <section className="glass p-6">
      <p className="text-xs text-red-400">Sync-Übersicht: {error}</p>
    </section>
  )

  if (!data) return null

  const { watchlist: wl, plex, jellyfin: jf, sonarr, radarr, tautulli, schedule } = data

  const runFullSync = async () => {
    setFullSyncing(true)
    setFullSyncResult(null)
    try {
      await api.post('/sync/full')
      // Poll status
      const poll = setInterval(async () => {
        try {
          const s = await api.get('/sync/full/status')
          setFullSyncResult([`Schritt: ${s.data.step}`, ...(s.data.results || [])])
          if (!s.data.running) {
            clearInterval(poll)
            setFullSyncing(false)
            api.get('/sync/overview').then(r => setData(r.data)).catch(() => {})
          }
        } catch { clearInterval(poll); setFullSyncing(false) }
      }, 3000)
    } catch {
      setFullSyncing(false)
      setFullSyncResult(['Fehler beim Starten'])
    }
  }

  return (
    <section className="glass p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
          <HiArrowPath className="w-4 h-4" /> Sync-Übersicht
        </h2>
        <button
          onClick={runFullSync}
          disabled={fullSyncing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 active:from-blue-500/30 active:to-purple-500/30 disabled:opacity-50"
        >
          <HiArrowPath className={`w-3.5 h-3.5 ${fullSyncing ? 'animate-spin' : ''}`} />
          {fullSyncing ? 'Voller Sync läuft...' : 'Voller Sync'}
        </button>
      </div>

      {/* Sync Progress */}
      {(fullSyncing || fullSyncResult) && (
        <div className={`rounded-xl p-3 mb-4 ${fullSyncing ? 'bg-blue-500/5 border border-blue-500/15' : 'bg-green-500/5 border border-green-500/15'}`}>
          {fullSyncing && (
            <div className="flex items-center gap-3 mb-2">
              {['plex', 'jellyfin', 'tautulli'].map(step => {
                const currentStep = fullSyncResult?.find(r => r.startsWith('Schritt:'))?.replace('Schritt: ', '') || ''
                const isDone = fullSyncResult?.some(r => r.toLowerCase().startsWith(step + ':'))
                const isActive = currentStep === step
                return (
                  <div key={step} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isDone ? 'bg-green-400' : isActive ? 'bg-blue-400 animate-pulse' : 'bg-white/15'}`} />
                    <span className={`text-[11px] capitalize ${isDone ? 'text-green-400' : isActive ? 'text-blue-400' : 'text-white/25'}`}>{step}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="space-y-0.5">
            {(fullSyncResult || []).filter(r => !r.startsWith('Schritt:')).map((r, i) => (
              <p key={i} className={`text-xs ${r.includes('OK') || r.includes('+') || r.includes('~') ? 'text-green-400' : r.includes('Fehler') || r.includes('error') ? 'text-red-400/70' : 'text-white/40'}`}>{r}</p>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {[
          { label: 'Filme', value: wl.movies, color: 'text-orange-400' },
          { label: 'Serien', value: wl.series, color: 'text-blue-400' },
          { label: 'Episoden', value: wl.episodes_watched, color: 'text-purple-400' },
          { label: 'Gesehen', value: wl.watched, color: 'text-green-400' },
          { label: 'Schaue ich', value: wl.watching, color: 'text-cyan-400' },
          { label: 'Gesamt', value: wl.total, color: 'text-white/70' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.04] rounded-xl p-2.5 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-white/30">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Services */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {[
          { name: 'Plex', connected: plex.connected, servers: plex.servers, bg: 'bg-amber-500/5', border: 'border-amber-500/20', dot: 'bg-amber-400', text: 'text-amber-300' },
          { name: 'Jellyfin', connected: jf.connected, servers: jf.servers, bg: 'bg-purple-500/5', border: 'border-purple-500/20', dot: 'bg-purple-400', text: 'text-purple-300' },
          { name: 'Sonarr', connected: sonarr.connected, servers: sonarr.servers, bg: 'bg-blue-500/5', border: 'border-blue-500/20', dot: 'bg-blue-400', text: 'text-blue-300' },
          { name: 'Radarr', connected: radarr.connected, servers: radarr.servers, bg: 'bg-orange-500/5', border: 'border-orange-500/20', dot: 'bg-orange-400', text: 'text-orange-300' },
          { name: 'Tautulli', connected: tautulli.connected, servers: tautulli.servers, bg: 'bg-pink-500/5', border: 'border-pink-500/20', dot: 'bg-pink-400', text: 'text-pink-300' },
        ].map(svc => {
          const online = svc.servers?.filter(s => s.status === 'online' || s.enabled !== false).length || 0
          const total = svc.servers?.length || 0
          return (
            <div key={svc.name} className={`rounded-xl p-2.5 border ${svc.connected ? `${svc.bg} ${svc.border}` : 'bg-white/[0.02] border-white/[0.06]'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${svc.connected ? svc.dot : 'bg-white/20'}`} />
                <span className={`text-xs font-medium ${svc.connected ? svc.text : 'text-white/30'}`}>{svc.name}</span>
              </div>
              {svc.connected ? (
                <p className="text-[10px] text-white/30 mt-1">
                  {total > 0 ? `${online}/${total} Server` : 'Verbunden'}
                </p>
              ) : (
                <p className="text-[10px] text-white/20 mt-1">Nicht verbunden</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Sync Schedule */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Sync-Zeitplan</p>
        <div className="space-y-1">
          {schedule.map((job, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${job.active ? 'bg-green-400' : 'bg-white/15'}`} />
              <span className={`flex-1 ${job.active ? 'text-white/50' : 'text-white/20'}`}>{job.name}</span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                job.type === 'realtime' ? 'bg-green-500/10 text-green-400' :
                job.type === 'nightly' ? 'bg-purple-500/10 text-purple-400' :
                'bg-white/[0.06] text-white/40'
              }`}>{job.interval}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sync Activity */}
      {data.recent_logs?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Letzte Sync-Aktivitäten</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.recent_logs.map((log, i) => {
              const sourceColors = { plex: 'text-amber-400', jellyfin: 'text-purple-400', tautulli: 'text-pink-400', app: 'text-blue-400' }
              const dirIcons = { import: '↓', export: '↑', bidirectional: '↔' }
              const time = new Date(log.created_at)
              const timeStr = time.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              return (
                <div key={i} className="flex items-start gap-2 text-[11px] bg-white/[0.02] rounded-lg px-2.5 py-1.5">
                  <span className="text-white/20 shrink-0 w-14">{timeStr}</span>
                  <span className={`shrink-0 font-medium ${sourceColors[log.source] || 'text-white/40'}`}>
                    {dirIcons[log.direction] || '•'} {log.source}
                  </span>
                  <span className="flex-1 text-white/40 truncate">
                    {log.added > 0 && <span className="text-green-400">+{log.added}</span>}
                    {log.updated > 0 && <span className="text-blue-400 ml-1">~{log.updated}</span>}
                    {log.errors > 0 && <span className="text-red-400 ml-1">!{log.errors}</span>}
                    {log.details && <span className="ml-1 text-white/25">{log.details.slice(0, 60)}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

export default function Settings() {
  const { user, logout, refreshUser } = useAuth()
  const [adminStats, setAdminStats] = useState(null)
  const [adminUsers, setAdminUsers] = useState([])
  const [showAdmin, setShowAdmin] = useState(false)

  // Tautulli Servers (admin)
  const [servers, setServers] = useState([])
  const [newServer, setNewServer] = useState({ name: '', url: '', api_key: '' })
  const [showAddServer, setShowAddServer] = useState(false)
  const [serverTestResults, setServerTestResults] = useState({})

  // Sonarr Servers (admin)
  const [sonarrServers, setSonarrServers] = useState([])
  const [newSonarrServer, setNewSonarrServer] = useState({ name: '', url: '', api_key: '' })
  const [showAddSonarr, setShowAddSonarr] = useState(false)
  const [sonarrTestResults, setSonarrTestResults] = useState({})

  // Plex Servers (admin)
  const [plexServers, setPlexServers] = useState([])
  const [newPlexServer, setNewPlexServer] = useState({ name: '', url: '', token: '' })
  const [showAddPlex, setShowAddPlex] = useState(false)
  const [plexTestResults, setPlexTestResults] = useState({})
  const [editingPlex, setEditingPlex] = useState(null) // server id
  const [editPlexForm, setEditPlexForm] = useState({ name: '', url: '' })

  // Radarr Servers (admin)
  const [radarrServers, setRadarrServers] = useState([])
  const [newRadarrServer, setNewRadarrServer] = useState({ name: '', url: '', api_key: '' })
  const [showAddRadarr, setShowAddRadarr] = useState(false)
  const [radarrTestResults, setRadarrTestResults] = useState({})

  // Jellyfin (per user)
  const [jellyfinServers, setJellyfinServers] = useState([])
  const [showAddJellyfin, setShowAddJellyfin] = useState(false)
  const [newJellyfin, setNewJellyfin] = useState({ name: '', url: '', username: '', password: '' })
  const [jellyfinError, setJellyfinError] = useState(null)
  const [jellyfinSyncResult, setJellyfinSyncResult] = useState(null)

  // API Keys
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewKey, setShowNewKey] = useState(null) // full key shown once
  const [showAddKey, setShowAddKey] = useState(false)

  // Download Profiles (admin)
  const [dlProfiles, setDlProfiles] = useState([])
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [profileForm, setProfileForm] = useState({ name: '', match_type: 'movie', server_type: 'radarr', server_id: '', quality_profile_id: '', root_folder_path: '', monitor_strategy: 'none', auto_search: false, enabled: true })
  const [profileServerOptions, setProfileServerOptions] = useState({ profiles: [], rootFolders: [] })

  // Plex Connections (user)
  const [allServers, setAllServers] = useState([])
  const [connections, setConnections] = useState([])
  const [plexLinking, setPlexLinking] = useState(null) // server_id being linked
  const [plexError, setPlexError] = useState(null)

  // Sync
  const [syncResult, setSyncResult] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const loadServers = useCallback(async () => {
    try {
      const res = await api.get('/tautulli/servers')
      if (user?.is_admin) setServers(res.data)
      setAllServers(res.data)
    } catch {}
  }, [user])

  const loadSonarrServers = useCallback(async () => {
    if (!user?.is_admin) return
    try {
      const res = await api.get('/sonarr/servers')
      setSonarrServers(res.data)
    } catch {}
  }, [user])

  const loadPlexServers = useCallback(async () => {
    if (!user?.is_admin) return
    try {
      const res = await api.get('/plex/servers')
      setPlexServers(res.data)
    } catch {}
  }, [user])

  const loadRadarrServers = useCallback(async () => {
    if (!user?.is_admin) return
    try {
      const res = await api.get('/radarr/servers')
      setRadarrServers(res.data)
    } catch {}
  }, [user])

  const loadJellyfinServers = useCallback(async () => {
    try { setJellyfinServers((await api.get('/jellyfin/servers')).data) } catch {}
  }, [])

  const addJellyfinServer = async () => {
    setJellyfinError(null)
    try {
      await api.post('/jellyfin/servers', newJellyfin)
      setNewJellyfin({ name: '', url: '', username: '', password: '' })
      setShowAddJellyfin(false)
      loadJellyfinServers()
    } catch (e) { setJellyfinError(e.response?.data?.detail || 'Fehler') }
  }

  const loadApiKeys = useCallback(async () => {
    try {
      const res = await api.get('/admin/api-keys')
      setApiKeys(res.data)
    } catch {}
  }, [])

  const loadDlProfiles = useCallback(async () => {
    if (!user?.is_admin) return
    try {
      const res = await api.get('/admin/download-profiles')
      setDlProfiles(res.data)
    } catch {}
  }, [user])

  const loadConnections = useCallback(async () => {
    try {
      const res = await api.get('/tautulli/connections')
      setConnections(res.data)
    } catch {}
  }, [])

  useEffect(() => {
    if (user?.is_admin) {
      api.get('/admin/stats').then(r => setAdminStats(r.data)).catch(() => {})
    }
    loadServers()
    loadConnections()
    loadSonarrServers()
    loadRadarrServers()
    loadPlexServers()
    loadDlProfiles()
    loadApiKeys()
    loadJellyfinServers()
  }, [user, loadServers, loadConnections, loadSonarrServers, loadRadarrServers, loadPlexServers, loadDlProfiles, loadApiKeys])

  // Complete Plex auth after redirect
  useEffect(() => {
    const pinId = localStorage.getItem('plex_pin_id')
    const serverId = localStorage.getItem('plex_server_id')
    if (!pinId || !serverId) return

    let attempts = 0
    const tryComplete = async () => {
      attempts++
      try {
        await api.post(`/tautulli/servers/${serverId}/plex/callback?pin_id=${pinId}`)
        localStorage.removeItem('plex_pin_id')
        localStorage.removeItem('plex_server_id')
        loadConnections()
        refreshUser()
      } catch {
        if (attempts < 10) setTimeout(tryComplete, 2000)
        else {
          localStorage.removeItem('plex_pin_id')
          localStorage.removeItem('plex_server_id')
          setPlexError('Plex-Verknüpfung fehlgeschlagen — bitte erneut versuchen')
        }
      }
    }
    tryComplete()
  }, [refreshUser, loadConnections])

  const loadAdminUsers = async () => {
    try {
      const res = await api.get('/admin/users')
      setAdminUsers(res.data)
      setShowAdmin(true)
    } catch {}
  }

  const toggleUserAdmin = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/admin`)
      loadAdminUsers()
    } catch {}
  }

  const toggleUserInstaller = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/installer`)
      loadAdminUsers()
    } catch {}
  }

  // --- Server Management (Admin) ---
  const addServer = async () => {
    if (!newServer.name || !newServer.url || !newServer.api_key) return
    try {
      await api.post('/tautulli/servers', newServer)
      setNewServer({ name: '', url: '', api_key: '' })
      setShowAddServer(false)
      loadServers()
    } catch {}
  }

  const deleteServer = async (id) => {
    try {
      await api.delete(`/tautulli/servers/${id}`)
      loadServers()
      loadConnections()
    } catch {}
  }

  const testServer = async (id) => {
    setServerTestResults(prev => ({ ...prev, [id]: { loading: true } }))
    try {
      const res = await api.post(`/tautulli/servers/${id}/test`)
      setServerTestResults(prev => ({ ...prev, [id]: { ok: true, version: res.data.version } }))
    } catch (e) {
      setServerTestResults(prev => ({ ...prev, [id]: { ok: false, error: e.response?.data?.detail || 'Fehler' } }))
    }
  }

  // --- Sonarr Server Management (Admin) ---
  const addSonarrServer = async () => {
    if (!newSonarrServer.name || !newSonarrServer.url || !newSonarrServer.api_key) return
    try {
      await api.post('/sonarr/servers', newSonarrServer)
      setNewSonarrServer({ name: '', url: '', api_key: '' })
      setShowAddSonarr(false)
      loadSonarrServers()
    } catch (e) {
      console.error('Sonarr server add failed:', e.response?.data || e)
    }
  }

  const deleteSonarrServer = async (id) => {
    try {
      await api.delete(`/sonarr/servers/${id}`)
      loadSonarrServers()
    } catch {}
  }

  const testSonarrServer = async (id) => {
    setSonarrTestResults(prev => ({ ...prev, [id]: { loading: true } }))
    try {
      const res = await api.post(`/sonarr/servers/${id}/test`)
      setSonarrTestResults(prev => ({ ...prev, [id]: { ok: true, version: res.data.version } }))
    } catch (e) {
      setSonarrTestResults(prev => ({ ...prev, [id]: { ok: false, error: e.response?.data?.detail || 'Fehler' } }))
    }
  }

  // --- Toggle Service (Admin) ---
  const toggleService = async (type, id, loadFn) => {
    try {
      await api.put(`/admin/services/${type}/${id}/toggle`)
      loadFn()
    } catch {}
  }

  // --- Plex Server Management (Admin) ---
  const addPlexServer = async () => {
    if (!newPlexServer.url || !newPlexServer.token) return
    try {
      await api.post('/plex/servers', newPlexServer)
      setNewPlexServer({ name: '', url: '', token: '' })
      setShowAddPlex(false)
      loadPlexServers()
    } catch (e) {
      setPlexTestResults(prev => ({ ...prev, new: { ok: false, error: e.response?.data?.detail || 'Fehler' } }))
    }
  }

  const deletePlexServer = async (id) => {
    try { await api.delete(`/plex/servers/${id}`); loadPlexServers() } catch {}
  }

  const testPlexServer = async (id) => {
    setPlexTestResults(prev => ({ ...prev, [id]: { loading: true } }))
    try {
      const res = await api.post(`/plex/servers/${id}/test`)
      setPlexTestResults(prev => ({ ...prev, [id]: { ok: true, name: res.data.name, version: res.data.version } }))
    } catch (e) {
      setPlexTestResults(prev => ({ ...prev, [id]: { ok: false, error: e.response?.data?.detail || 'Fehler' } }))
    }
  }

  // --- Radarr Server Management (Admin) ---
  const addRadarrServer = async () => {
    if (!newRadarrServer.name || !newRadarrServer.url || !newRadarrServer.api_key) return
    try {
      await api.post('/radarr/servers', newRadarrServer)
      setNewRadarrServer({ name: '', url: '', api_key: '' })
      setShowAddRadarr(false)
      loadRadarrServers()
    } catch (e) {
      console.error('Radarr server add failed:', e.response?.data || e)
    }
  }

  const deleteRadarrServer = async (id) => {
    try {
      await api.delete(`/radarr/servers/${id}`)
      loadRadarrServers()
    } catch {}
  }

  const testRadarrServer = async (id) => {
    setRadarrTestResults(prev => ({ ...prev, [id]: { loading: true } }))
    try {
      const res = await api.post(`/radarr/servers/${id}/test`)
      setRadarrTestResults(prev => ({ ...prev, [id]: { ok: true, version: res.data.version } }))
    } catch (e) {
      setRadarrTestResults(prev => ({ ...prev, [id]: { ok: false, error: e.response?.data?.detail || 'Fehler' } }))
    }
  }

  // --- Download Profiles (Admin) ---
  const loadProfileServerOptions = async (serverType, serverId) => {
    if (!serverId) { setProfileServerOptions({ profiles: [], rootFolders: [] }); return }
    try {
      const base = serverType === 'radarr' ? '/radarr' : '/sonarr'
      const [p, f] = await Promise.all([
        api.get(`${base}/servers/${serverId}/profiles`),
        api.get(`${base}/servers/${serverId}/rootfolders`),
      ])
      setProfileServerOptions({ profiles: p.data, rootFolders: f.data })
    } catch {}
  }

  const openProfileForm = (profile = null) => {
    if (profile) {
      setEditingProfile(profile.id)
      setProfileForm({ ...profile })
      loadProfileServerOptions(profile.server_type, profile.server_id)
    } else {
      setEditingProfile(null)
      setProfileForm({ name: '', match_type: 'movie', server_type: 'radarr', server_id: '', quality_profile_id: '', root_folder_path: '', monitor_strategy: 'none', auto_search: false, enabled: true })
      setProfileServerOptions({ profiles: [], rootFolders: [] })
    }
    setShowAddProfile(true)
  }

  const saveProfile = async () => {
    try {
      if (editingProfile) {
        await api.put(`/admin/download-profiles/${editingProfile}`, profileForm)
      } else {
        await api.post('/admin/download-profiles', profileForm)
      }
      setShowAddProfile(false)
      loadDlProfiles()
    } catch {}
  }

  const deleteProfile = async (id) => {
    try {
      await api.delete(`/admin/download-profiles/${id}`)
      loadDlProfiles()
    } catch {}
  }

  const toggleProfile = async (profile) => {
    try {
      await api.put(`/admin/download-profiles/${profile.id}`, { ...profile, enabled: !profile.enabled })
      loadDlProfiles()
    } catch {}
  }

  // --- Plex OAuth (User) ---
  const linkPlex = async (serverId) => {
    setPlexLinking(serverId)
    setPlexError(null)
    try {
      const callbackUrl = `${window.location.origin}/settings`
      const { data } = await api.post(`/tautulli/servers/${serverId}/plex/pin?forward_url=${encodeURIComponent(callbackUrl)}`)
      localStorage.setItem('plex_pin_id', data.pin_id)
      localStorage.setItem('plex_server_id', serverId)
      window.location.href = data.auth_url
    } catch {
      setPlexLinking(null)
      setPlexError('Fehler beim Starten der Plex-Anmeldung')
    }
  }

  const unlinkPlex = async (connectionId) => {
    try {
      await api.delete(`/tautulli/connections/${connectionId}`)
      loadConnections()
    } catch {}
  }

  const triggerSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await api.post('/tautulli/sync')
      setSyncResult(res.data)
      refreshUser()
    } catch (e) {
      setSyncResult({ error: e.response?.data?.detail || 'Sync fehlgeschlagen' })
    }
    setSyncing(false)
  }

  // Which servers is user NOT connected to?
  const connectedServerIds = new Set(connections.map(c => c.server_id))
  const unconnectedServers = allServers.filter(s => !connectedServerIds.has(s.id))

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      {/* Sync Overview */}
      <SyncOverview />

      {/* Profile */}
      <section className="glass p-6">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Profil</h2>
        <div className="flex items-center gap-4">
          {user?.plex_avatar ? (
            <img src={user.plex_avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold flex items-center gap-2">
              {user?.username}
              {user?.is_admin && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-lg">Admin</span>
              )}
              {user?.is_installer && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-lg">Installer</span>
              )}
            </p>
            <p className="text-sm text-white/40">{user?.email}</p>
            {user?.auth_provider === 'plex' && (
              <p className="text-xs text-amber-400/60 flex items-center gap-1 mt-0.5">Angemeldet über Plex</p>
            )}
          </div>
        </div>

        {/* Link Plex — only for local accounts without plex_id */}
        {user?.auth_provider !== 'plex' && !user?.plex_username && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <button
              onClick={async () => {
                const authWindow = window.open('about:blank', 'plex_link', 'width=800,height=600')
                try {
                  const pinRes = await api.post('/auth/plex/pin')
                  if (authWindow) authWindow.location.href = pinRes.data.auth_url
                  const poll = setInterval(async () => {
                    try {
                      const res = await api.post('/auth/plex/link', { pin_id: pinRes.data.pin_id })
                      if (res.data.status === 'waiting') return
                      clearInterval(poll)
                      if (authWindow && !authWindow.closed) authWindow.close()
                      refreshUser()
                    } catch { clearInterval(poll) }
                  }, 2000)
                } catch {}
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#e5a00d] text-black active:bg-[#c98c0b]"
            >
              Plex-Account verknüpfen
            </button>
            <p className="text-[10px] text-white/25 mt-1.5 text-center">Verknüpfe deinen Plex-Account um dich später mit Plex anzumelden</p>
          </div>
        )}

        {/* Already linked */}
        {user?.plex_username && user?.auth_provider !== 'plex' && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <span className="text-xs text-green-400">Plex verknüpft:</span>
            <span className="text-xs text-white/50">{user.plex_username}</span>
          </div>
        )}
      </section>

      {/* Tautulli Plex Connections — only show if user has no plex_username yet */}
      {!user?.plex_username && (
      <section className="glass p-6">
        <h2 className="text-sm font-medium text-purple-400/70 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="text-lg">▶️</span> Tautulli Plex-Verbindung
        </h2>

        {/* Connected servers */}
        {connections.length > 0 && (
          <div className="space-y-2 mb-3">
            {connections.map(conn => (
              <div key={conn.id} className="flex items-center justify-between bg-green-500/10 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <HiCheck className="w-5 h-5 text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-300">{conn.server_name}</p>
                    <p className="text-[11px] text-white/40">{conn.plex_username}</p>
                    {conn.last_sync && (
                      <p className="text-[10px] text-white/25">Sync: {new Date(conn.last_sync).toLocaleString('de-DE')}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => unlinkPlex(conn.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 active:bg-red-500/20 transition-all shrink-0"
                >
                  <HiXCircle className="w-3.5 h-3.5" />
                  Trennen
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Connect to more servers */}
        {unconnectedServers.length > 0 && (
          <div className="space-y-2 mb-3">
            {unconnectedServers.map(server => (
              <button
                key={server.id}
                onClick={() => linkPlex(server.id)}
                disabled={plexLinking === server.id}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-black active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {plexLinking === server.id ? (
                  <><HiArrowPath className="w-4 h-4 animate-spin" /> Weiterleitung...</>
                ) : (
                  <><HiLink className="w-4 h-4" /> Mit {server.name} verknüpfen</>
                )}
              </button>
            ))}
          </div>
        )}

        {allServers.length === 0 && connections.length === 0 && (
          <p className="text-xs text-white/30">Noch keine Tautulli-Server konfiguriert. Ein Admin muss zuerst Server hinzufügen.</p>
        )}

        {plexError && (
          <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl mb-3">{plexError}</p>
        )}

        {/* Sync (only if connected) */}
        {connections.length > 0 && (
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/50">Watch-History synchronisieren</p>
              <button
                onClick={triggerSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-purple-500/20 text-purple-400 active:bg-purple-500/30 transition-all"
              >
                <HiArrowPath className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
              </button>
            </div>

            {syncResult && (
              <div className={`p-2.5 rounded-xl text-xs ${syncResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                {syncResult.error
                  ? syncResult.error
                  : `${syncResult.added} neu, ${syncResult.updated} aktualisiert (${syncResult.total_entries} Einträge)`
                }
              </div>
            )}
            <p className="text-[10px] text-white/20 mt-2">Auto-Sync alle 30 Minuten</p>
          </div>
        )}
      </section>
      )}

      {/* Admin Section */}
      {user?.is_admin && (
        <section className="glass p-6">
          <h2 className="text-sm font-medium text-amber-400/70 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiShieldCheck className="w-4 h-4" /> Admin-Bereich
          </h2>

          {/* Jellyfin Login URL */}
          <div className="mb-4 pb-4 border-b border-white/[0.06]">
            <p className="text-xs text-white/40 mb-1.5">Jellyfin Login Server (für alle User)</p>
            <div className="flex gap-2">
              <input
                id="jf-login-url"
                defaultValue=""
                placeholder="https://jellyfin.example.com"
                className="glass-input py-2 text-sm flex-1"
                ref={el => {
                  if (el && !el.dataset.loaded) {
                    el.dataset.loaded = 'true'
                    api.get('/admin/settings/jellyfin-login-url').then(r => { if (r.data.url) el.value = r.data.url }).catch(() => {})
                  }
                }}
              />
              <button
                onClick={() => {
                  const url = document.getElementById('jf-login-url')?.value || ''
                  api.put('/admin/settings/jellyfin-login-url', { url }).then(() => alert(url ? 'Gespeichert — Jellyfin Login ist jetzt aktiv' : 'Jellyfin Login deaktiviert')).catch(() => {})
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-purple-500/20 text-purple-400"
              >
                Speichern
              </button>
            </div>
            <p className="text-[10px] text-white/20 mt-1">Wenn gesetzt, können sich User mit Jellyfin-Credentials anmelden</p>
          </div>

          {/* Stats */}
          {adminStats && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Benutzer', value: adminStats.users },
                { label: 'Filme', value: adminStats.movies },
                { label: 'Listen', value: adminStats.watchlists },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/[0.04] rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">{value}</div>
                  <div className="text-[10px] text-white/40">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* User Management */}
          <button
            onClick={loadAdminUsers}
            className="w-full glass-light p-3 rounded-xl flex items-center gap-3 text-sm active:bg-white/[0.06] mb-2"
          >
            <HiUsers className="w-5 h-5 text-white/40" />
            <span>Benutzer verwalten</span>
          </button>

          {showAdmin && adminUsers.length > 0 && (
            <div className="space-y-1.5 mt-3 mb-4">
              {adminUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {u.username}
                      {u.is_admin && <span className="text-[10px] text-amber-400">Admin</span>}
                      {u.is_installer && <span className="text-[10px] text-blue-400">Installer</span>}
                    </p>
                    <p className="text-[11px] text-white/30">{u.email}</p>
                  </div>
                  {u.id !== user.id && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => toggleUserAdmin(u.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95 ${
                          u.is_admin ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {u.is_admin ? 'Admin -' : 'Admin'}
                      </button>
                      <button
                        onClick={() => toggleUserInstaller(u.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95 ${
                          u.is_installer ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {u.is_installer ? 'Installer -' : 'Installer'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tautulli Servers */}
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span>▶️</span> Tautulli Server
              </p>
              <button
                onClick={() => setShowAddServer(!showAddServer)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-amber-400 bg-amber-500/10 active:bg-amber-500/20 transition-all"
              >
                <HiPlus className="w-3.5 h-3.5" />
                Hinzufügen
              </button>
            </div>

            {/* Existing servers */}
            {servers.map(s => (
              <div key={s.id} className={`bg-white/[0.03] p-3 rounded-xl mb-2 ${s.enabled === false ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleService('tautulli', s.id, loadServers)} className={`px-2 py-1 rounded-lg text-[10px] ${s.enabled !== false ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/30'}`}>
                      {s.enabled !== false ? 'AN' : 'AUS'}
                    </button>
                    <button
                      onClick={() => testServer(s.id)}
                      className="px-2 py-1 rounded-lg text-[10px] bg-white/[0.06] text-white/50 active:bg-white/[0.1]"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => deleteServer(s.id)}
                      className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-400 active:bg-red-500/20"
                    >
                      <HiTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-white/30">{s.url}</p>
                {serverTestResults[s.id] && (
                  <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${serverTestResults[s.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                    {serverTestResults[s.id].loading ? '...' : serverTestResults[s.id].ok
                      ? <><HiCheck className="w-3 h-3" /> v{serverTestResults[s.id].version}</>
                      : <><HiXMark className="w-3 h-3" /> {serverTestResults[s.id].error}</>
                    }
                  </div>
                )}
              </div>
            ))}

            {/* Add new server form */}
            {showAddServer && (
              <div className="bg-white/[0.03] p-3 rounded-xl space-y-2 mt-2">
                <input
                  type="text"
                  value={newServer.name}
                  onChange={e => setNewServer(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name (z.B. Chase's Server)"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="text"
                  value={newServer.url}
                  onChange={e => setNewServer(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://tautulli.example.com"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="password"
                  value={newServer.api_key}
                  onChange={e => setNewServer(p => ({ ...p, api_key: e.target.value }))}
                  placeholder="API-Key"
                  className="glass-input py-2 text-sm w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddServer(false)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={addServer}
                    disabled={!newServer.name || !newServer.url || !newServer.api_key}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/20 text-amber-400 disabled:opacity-30"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Plex Servers */}
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Plex Server
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={async () => {
                    try {
                      const res = await api.post('/plex/discover')
                      if (res.data.added > 0) {
                        loadPlexServers()
                      }
                      alert(`${res.data.added} neue Server gefunden (${res.data.total} gesamt)`)
                    } catch (e) {
                      alert(e.response?.data?.detail || 'Discovery fehlgeschlagen')
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-amber-400 bg-amber-500/10 active:bg-amber-500/20 transition-all"
                >
                  <HiArrowPath className="w-3.5 h-3.5" />
                  Auto-Discover
                </button>
                <button
                  onClick={() => setShowAddPlex(!showAddPlex)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white/40 bg-white/[0.06] active:bg-white/[0.1] transition-all"
                >
                  <HiPlus className="w-3.5 h-3.5" />
                  Manuell
                </button>
              </div>
            </div>

            {plexServers.map(s => (
              <div key={s.id} className={`bg-white/[0.03] p-3 rounded-xl mb-2 ${s.enabled === false ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleService('plex', s.id, loadPlexServers)} className={`px-2 py-1 rounded-lg text-[10px] ${s.enabled !== false ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/30'}`}>
                      {s.enabled !== false ? 'AN' : 'AUS'}
                    </button>
                    <button onClick={() => { setEditingPlex(editingPlex === s.id ? null : s.id); setEditPlexForm({ name: s.name, url: s.url }) }} className={`px-2 py-1 rounded-lg text-[10px] ${editingPlex === s.id ? 'bg-blue-500/15 text-blue-400' : 'bg-white/[0.06] text-white/50 active:bg-white/[0.1]'}`}>
                      Edit
                    </button>
                    <button onClick={() => testPlexServer(s.id)} className="px-2 py-1 rounded-lg text-[10px] bg-white/[0.06] text-white/50 active:bg-white/[0.1]">Test</button>
                    <button onClick={() => deletePlexServer(s.id)} className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-400 active:bg-red-500/20">
                      <HiTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {editingPlex === s.id ? (
                  <div className="space-y-2 mt-2">
                    <input value={editPlexForm.name} onChange={e => setEditPlexForm(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="glass-input py-1.5 text-sm w-full" />
                    <input value={editPlexForm.url} onChange={e => setEditPlexForm(p => ({ ...p, url: e.target.value }))} placeholder="URL" className="glass-input py-1.5 text-sm w-full" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditingPlex(null)} className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-white/[0.06] text-white/40">Abbrechen</button>
                      <button onClick={async () => { try { await api.put(`/plex/servers/${s.id}`, editPlexForm); setEditingPlex(null); loadPlexServers() } catch {} }} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400">Speichern</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-white/30">{s.url}</p>
                )}
                {plexTestResults[s.id] && (
                  <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${plexTestResults[s.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                    {plexTestResults[s.id].loading ? '...' : plexTestResults[s.id].ok
                      ? <><HiCheck className="w-3 h-3" /> {plexTestResults[s.id].name} · v{plexTestResults[s.id].version}</>
                      : <><HiXMark className="w-3 h-3" /> {plexTestResults[s.id].error}</>
                    }
                  </div>
                )}
              </div>
            ))}

            {showAddPlex && (
              <div className="bg-white/[0.03] p-3 rounded-xl space-y-2 mt-2">
                <input
                  type="text"
                  value={newPlexServer.name}
                  onChange={e => setNewPlexServer(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name (optional — wird vom Server geholt)"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="text"
                  value={newPlexServer.url}
                  onChange={e => setNewPlexServer(p => ({ ...p, url: e.target.value }))}
                  placeholder="http://192.168.1.x:32400"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="password"
                  value={newPlexServer.token}
                  onChange={e => setNewPlexServer(p => ({ ...p, token: e.target.value }))}
                  placeholder="Plex Token"
                  className="glass-input py-2 text-sm w-full"
                />
                <p className="text-[10px] text-white/20">Token findest du in Plex unter Einstellungen → Fehlerbehebung → XML-Daten</p>
                {plexTestResults.new && !plexTestResults.new.ok && (
                  <p className="text-xs text-red-400">{plexTestResults.new.error}</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowAddPlex(false)} className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50">Abbrechen</button>
                  <button
                    onClick={addPlexServer}
                    disabled={!newPlexServer.url || !newPlexServer.token}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/20 text-amber-400 disabled:opacity-30"
                  >
                    Verbinden
                  </button>
                </div>
              </div>
            )}

            {/* Plex Sync */}
            {plexServers.length > 0 && (
              <div className="pt-3 mt-3 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/50">Plex Watch-History synchronisieren</p>
                  <button
                    onClick={async () => {
                      setPlexTestResults(p => ({ ...p, sync: { loading: true } }))
                      try {
                        await api.post('/plex/sync')
                        // Poll for status
                        const poll = setInterval(async () => {
                          try {
                            const status = await api.get('/plex/sync/status')
                            const d = status.data
                            setPlexTestResults(p => ({ ...p, sync: { loading: d.running, ok: !d.running && !d.error, ...d } }))
                            if (!d.running) {
                              clearInterval(poll)
                              refreshUser()
                            }
                          } catch { clearInterval(poll); setPlexTestResults(p => ({ ...p, sync: { loading: false, ok: false, error: 'Status nicht verfügbar' } })) }
                        }, 2000)
                      } catch (e) {
                        setPlexTestResults(p => ({ ...p, sync: { loading: false, ok: false, error: e.response?.data?.detail || 'Sync fehlgeschlagen' } }))
                      }
                    }}
                    disabled={plexTestResults.sync?.loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/20 text-amber-400 active:bg-amber-500/30 disabled:opacity-50"
                  >
                    <HiArrowPath className={`w-3.5 h-3.5 ${plexTestResults.sync?.loading ? 'animate-spin' : ''}`} />
                    {plexTestResults.sync?.loading ? `Synchronisiere... ${plexTestResults.sync?.total_scanned || 0} gescannt` : 'Jetzt synchronisieren'}
                  </button>
                </div>
                {plexTestResults.sync && !plexTestResults.sync.loading && (plexTestResults.sync.ok || plexTestResults.sync.error) && (
                  <div className={`p-2.5 rounded-xl text-xs ${plexTestResults.sync.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {plexTestResults.sync.ok
                      ? `${plexTestResults.sync.added} neu, ${plexTestResults.sync.updated} aktualisiert (${plexTestResults.sync.total_scanned} gescannt)`
                      : plexTestResults.sync.error
                    }
                    {plexTestResults.sync.errors?.length > 0 && (
                      <div className="mt-1 text-red-400/70">{plexTestResults.sync.errors.join(', ')}</div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-white/20 mt-2">Auto-Sync alle 10 Minuten (nur kürzlich geschaut)</p>

                {/* Watchlist → Plex Watchlist sync */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                  <p className="text-xs text-white/50">Merkliste → Plex Watchlist</p>
                  <button
                    onClick={async () => {
                      setPlexTestResults(p => ({ ...p, wlSync: { loading: true } }))
                      try {
                        const res = await api.post('/plex/sync/watchlist')
                        setPlexTestResults(p => ({ ...p, wlSync: { ok: true, ...res.data } }))
                      } catch (e) {
                        setPlexTestResults(p => ({ ...p, wlSync: { ok: false, error: e.response?.data?.detail || 'Fehler' } }))
                      }
                    }}
                    disabled={plexTestResults.wlSync?.loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/20 text-amber-400 active:bg-amber-500/30 disabled:opacity-50"
                  >
                    <HiArrowPath className={`w-3.5 h-3.5 ${plexTestResults.wlSync?.loading ? 'animate-spin' : ''}`} />
                    {plexTestResults.wlSync?.loading ? 'Synce...' : 'Jetzt syncen'}
                  </button>
                </div>
                {plexTestResults.wlSync && !plexTestResults.wlSync.loading && (
                  <div className={`p-2.5 rounded-xl text-xs mt-1.5 ${plexTestResults.wlSync.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {plexTestResults.wlSync.ok
                      ? `${plexTestResults.wlSync.added} zur Plex Watchlist, ${plexTestResults.wlSync.removed} entfernt (${plexTestResults.wlSync.total_checked} geprüft)`
                      : plexTestResults.wlSync.error}
                  </div>
                )}
                <p className="text-[10px] text-white/20 mt-1">Watchlist/Geplant/Schaue ich → Plex Merkliste. Gesehen → wird entfernt.</p>
              </div>
            )}
          </div>

          {/* Sonarr Servers */}
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Sonarr Server
              </p>
              <button
                onClick={() => setShowAddSonarr(!showAddSonarr)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-blue-400 bg-blue-500/10 active:bg-blue-500/20 transition-all"
              >
                <HiPlus className="w-3.5 h-3.5" />
                Hinzufügen
              </button>
            </div>

            {sonarrServers.map(s => (
              <div key={s.id} className={`bg-white/[0.03] p-3 rounded-xl mb-2 ${s.enabled === false ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleService('sonarr', s.id, loadSonarrServers)} className={`px-2 py-1 rounded-lg text-[10px] ${s.enabled !== false ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/30'}`}>
                      {s.enabled !== false ? 'AN' : 'AUS'}
                    </button>
                    <button
                      onClick={() => testSonarrServer(s.id)}
                      className="px-2 py-1 rounded-lg text-[10px] bg-white/[0.06] text-white/50 active:bg-white/[0.1]"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => deleteSonarrServer(s.id)}
                      className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-400 active:bg-red-500/20"
                    >
                      <HiTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-white/30">{s.url}</p>
                {sonarrTestResults[s.id] && (
                  <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${sonarrTestResults[s.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                    {sonarrTestResults[s.id].loading ? '...' : sonarrTestResults[s.id].ok
                      ? <><HiCheck className="w-3 h-3" /> v{sonarrTestResults[s.id].version}</>
                      : <><HiXMark className="w-3 h-3" /> {sonarrTestResults[s.id].error}</>
                    }
                  </div>
                )}
              </div>
            ))}

            {showAddSonarr && (
              <div className="bg-white/[0.03] p-3 rounded-xl space-y-2 mt-2">
                <input
                  type="text"
                  value={newSonarrServer.name}
                  onChange={e => setNewSonarrServer(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name (z.B. Sonarr Anime)"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="text"
                  value={newSonarrServer.url}
                  onChange={e => setNewSonarrServer(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://sonarr.example.com"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="password"
                  value={newSonarrServer.api_key}
                  onChange={e => setNewSonarrServer(p => ({ ...p, api_key: e.target.value }))}
                  placeholder="API-Key"
                  className="glass-input py-2 text-sm w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddSonarr(false)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={addSonarrServer}
                    disabled={!newSonarrServer.name || !newSonarrServer.url || !newSonarrServer.api_key}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-blue-500/20 text-blue-400 disabled:opacity-30"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Radarr Servers */}
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Radarr Server
              </p>
              <button
                onClick={() => setShowAddRadarr(!showAddRadarr)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-orange-400 bg-orange-500/10 active:bg-orange-500/20 transition-all"
              >
                <HiPlus className="w-3.5 h-3.5" />
                Hinzufügen
              </button>
            </div>

            {radarrServers.map(s => (
              <div key={s.id} className={`bg-white/[0.03] p-3 rounded-xl mb-2 ${s.enabled === false ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleService('radarr', s.id, loadRadarrServers)} className={`px-2 py-1 rounded-lg text-[10px] ${s.enabled !== false ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/30'}`}>
                      {s.enabled !== false ? 'AN' : 'AUS'}
                    </button>
                    <button
                      onClick={() => testRadarrServer(s.id)}
                      className="px-2 py-1 rounded-lg text-[10px] bg-white/[0.06] text-white/50 active:bg-white/[0.1]"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => deleteRadarrServer(s.id)}
                      className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-400 active:bg-red-500/20"
                    >
                      <HiTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-white/30">{s.url}</p>
                {radarrTestResults[s.id] && (
                  <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${radarrTestResults[s.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                    {radarrTestResults[s.id].loading ? '...' : radarrTestResults[s.id].ok
                      ? <><HiCheck className="w-3 h-3" /> v{radarrTestResults[s.id].version}</>
                      : <><HiXMark className="w-3 h-3" /> {radarrTestResults[s.id].error}</>
                    }
                  </div>
                )}
              </div>
            ))}

            {showAddRadarr && (
              <div className="bg-white/[0.03] p-3 rounded-xl space-y-2 mt-2">
                <input
                  type="text"
                  value={newRadarrServer.name}
                  onChange={e => setNewRadarrServer(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name (z.B. Radarr 4K)"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="text"
                  value={newRadarrServer.url}
                  onChange={e => setNewRadarrServer(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://radarr.example.com"
                  className="glass-input py-2 text-sm w-full"
                />
                <input
                  type="password"
                  value={newRadarrServer.api_key}
                  onChange={e => setNewRadarrServer(p => ({ ...p, api_key: e.target.value }))}
                  placeholder="API-Key"
                  className="glass-input py-2 text-sm w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddRadarr(false)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={addRadarrServer}
                    disabled={!newRadarrServer.name || !newRadarrServer.url || !newRadarrServer.api_key}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-orange-500/20 text-orange-400 disabled:opacity-30"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Download Profiles */}
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Auto-Download Profile
              </p>
              <button
                onClick={() => openProfileForm()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-green-400 bg-green-500/10 active:bg-green-500/20"
              >
                <HiPlus className="w-3.5 h-3.5" /> Neu
              </button>
            </div>

            <p className="text-[11px] text-white/30 mb-3">
              Filme/Serien werden beim Hinzufügen zur Watchlist automatisch zum passenden *arr Server geschickt.
            </p>

            {dlProfiles.length === 0 && !showAddProfile && (
              <p className="text-xs text-white/20 text-center py-3">Keine Profile konfiguriert</p>
            )}

            {dlProfiles.map(p => (
              <div key={p.id} className={`bg-white/[0.03] p-3 rounded-xl mb-2 ${!p.enabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.match_type === 'anime' ? 'bg-pink-500/15 text-pink-400' :
                      p.match_type === 'movie' ? 'bg-orange-500/15 text-orange-400' :
                      'bg-blue-500/15 text-blue-400'
                    }`}>
                      {p.match_type === 'anime' ? 'Anime' : p.match_type === 'movie' ? 'Filme' : 'Serien'}
                    </span>
                    <span className="text-sm font-medium text-white/70">{p.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleProfile(p)} className={`px-2 py-1 rounded-lg text-[10px] ${p.enabled ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/30'}`}>
                      {p.enabled ? 'AN' : 'AUS'}
                    </button>
                    <button onClick={() => openProfileForm(p)} className="px-2 py-1 rounded-lg text-[10px] bg-white/[0.06] text-white/50">
                      Edit
                    </button>
                    <button onClick={() => deleteProfile(p.id)} className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-400">
                      <HiTrash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-white/30">
                  {p.server_type} #{p.server_id} · {p.root_folder_path} · {p.auto_search ? 'Auto-Suche AN' : 'Nur hinzufügen'}
                </p>
              </div>
            ))}

            {showAddProfile && (
              <div className="bg-white/[0.03] p-3 rounded-xl space-y-2.5 mt-2 border border-green-500/15">
                <p className="text-xs font-medium text-green-400">{editingProfile ? 'Profil bearbeiten' : 'Neues Profil'}</p>

                <input
                  value={profileForm.name}
                  onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Name (z.B. Anime HD)"
                  className="glass-input py-2 text-sm w-full"
                />

                <div>
                  <label className="text-xs text-white/40 block mb-1">Wenn hinzugefügt als...</label>
                  <select
                    value={profileForm.match_type}
                    onChange={e => {
                      const mt = e.target.value
                      const st = mt === 'movie' ? 'radarr' : 'sonarr'
                      setProfileForm(p => ({ ...p, match_type: mt, server_type: st, server_id: '', quality_profile_id: '', root_folder_path: '' }))
                      setProfileServerOptions({ profiles: [], rootFolders: [] })
                    }}
                    className="glass-input py-2 text-sm w-full"
                  >
                    <option value="movie">Film</option>
                    <option value="anime">Anime (Tag "Anime")</option>
                    <option value="series">Serie (nicht Anime)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-white/40 block mb-1">Server</label>
                  <select
                    value={profileForm.server_id}
                    onChange={e => {
                      const sid = Number(e.target.value)
                      setProfileForm(p => ({ ...p, server_id: sid }))
                      if (sid) loadProfileServerOptions(profileForm.server_type, sid)
                    }}
                    className="glass-input py-2 text-sm w-full"
                  >
                    <option value="">Server wählen...</option>
                    {(profileForm.server_type === 'radarr' ? radarrServers : sonarrServers).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {profileForm.server_id && profileServerOptions.profiles.length > 0 && (
                  <>
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Quality Profile</label>
                      <select value={profileForm.quality_profile_id} onChange={e => setProfileForm(p => ({ ...p, quality_profile_id: Number(e.target.value) }))} className="glass-input py-2 text-sm w-full">
                        <option value="">Wählen...</option>
                        {profileServerOptions.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Speicherort</label>
                      <select value={profileForm.root_folder_path} onChange={e => setProfileForm(p => ({ ...p, root_folder_path: e.target.value }))} className="glass-input py-2 text-sm w-full">
                        <option value="">Wählen...</option>
                        {profileServerOptions.rootFolders.map(f => <option key={f.path} value={f.path}>{f.path} ({f.free_space_gb} GB frei)</option>)}
                      </select>
                    </div>
                    {profileForm.server_type === 'sonarr' && (
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Monitoring</label>
                        <select value={profileForm.monitor_strategy} onChange={e => setProfileForm(p => ({ ...p, monitor_strategy: e.target.value }))} className="glass-input py-2 text-sm w-full">
                          <option value="none">Keine — manuell</option>
                          <option value="all">Alle Episoden</option>
                          <option value="future">Nur zukünftige</option>
                          <option value="missing">Fehlende</option>
                        </select>
                      </div>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer py-1">
                      <input type="checkbox" checked={profileForm.auto_search} onChange={e => setProfileForm(p => ({ ...p, auto_search: e.target.checked }))} className="rounded border-white/20 bg-white/[0.06] w-4 h-4" />
                      <span className="text-sm text-white/60">Automatisch suchen/downloaden</span>
                    </label>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowAddProfile(false)} className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50">Abbrechen</button>
                  <button
                    onClick={saveProfile}
                    disabled={!profileForm.name || !profileForm.server_id || !profileForm.quality_profile_id || !profileForm.root_folder_path}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-green-500/20 text-green-400 disabled:opacity-30"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Jellyfin Servers (per user) */}
      <section className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Jellyfin
          </h2>
          <button
            onClick={() => setShowAddJellyfin && setShowAddJellyfin(!showAddJellyfin)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-purple-400 bg-purple-500/10 active:bg-purple-500/20"
          >
            <HiPlus className="w-3.5 h-3.5" /> Verbinden
          </button>
        </div>

        {jellyfinServers.map(s => (
          <div key={s.id} className={`bg-white/[0.03] p-3 rounded-xl mb-2 ${!s.enabled ? 'opacity-40' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">{s.name}</p>
              <div className="flex gap-1.5">
                <button onClick={() => toggleService('jellyfin', s.id, loadJellyfinServers)} className={`px-2 py-1 rounded-lg text-[10px] ${s.enabled ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/30'}`}>
                  {s.enabled ? 'AN' : 'AUS'}
                </button>
                <button
                  onClick={async () => {
                    setJellyfinSyncResult(p => ({ ...p, [`test_${s.id}`]: { loading: true } }))
                    try {
                      const res = await api.post(`/jellyfin/servers/${s.id}/test`)
                      setJellyfinSyncResult(p => ({ ...p, [`test_${s.id}`]: { ok: true, ...res.data } }))
                    } catch (e) {
                      setJellyfinSyncResult(p => ({ ...p, [`test_${s.id}`]: { ok: false, error: e.response?.data?.detail || 'Fehler' } }))
                    }
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] bg-white/[0.06] text-white/50 active:bg-white/[0.1]"
                >Test</button>
                <button onClick={async () => { try { await api.delete(`/jellyfin/servers/${s.id}`); loadJellyfinServers() } catch {} }} className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-400">
                  <HiTrash className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-white/30">{s.url}</p>
            {jellyfinSyncResult?.[`test_${s.id}`] && (
              <div className={`mt-1.5 text-[10px] flex items-center gap-1 ${jellyfinSyncResult[`test_${s.id}`].ok ? 'text-green-400' : 'text-red-400'}`}>
                {jellyfinSyncResult[`test_${s.id}`].loading ? '...' : jellyfinSyncResult[`test_${s.id}`].ok
                  ? <><HiCheck className="w-3 h-3" /> {jellyfinSyncResult[`test_${s.id}`].name} · v{jellyfinSyncResult[`test_${s.id}`].version}</>
                  : <><HiXMark className="w-3 h-3" /> {jellyfinSyncResult[`test_${s.id}`].error}</>
                }
              </div>
            )}
          </div>
        ))}

        {showAddJellyfin && (
          <div className="bg-white/[0.03] p-3 rounded-xl space-y-2 mt-2">
            <input value={newJellyfin.name} onChange={e => setNewJellyfin(p => ({ ...p, name: e.target.value }))} placeholder="Name (optional)" className="glass-input py-2 text-sm w-full" />
            <input value={newJellyfin.url} onChange={e => setNewJellyfin(p => ({ ...p, url: e.target.value }))} placeholder="https://jellyfin.example.com" className="glass-input py-2 text-sm w-full" />
            <input value={newJellyfin.username} onChange={e => setNewJellyfin(p => ({ ...p, username: e.target.value }))} placeholder="Benutzername" className="glass-input py-2 text-sm w-full" />
            <input type="password" value={newJellyfin.password} onChange={e => setNewJellyfin(p => ({ ...p, password: e.target.value }))} placeholder="Passwort" className="glass-input py-2 text-sm w-full" />
            {jellyfinError && <p className="text-xs text-red-400">{jellyfinError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowAddJellyfin(false)} className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50">Abbrechen</button>
              <button onClick={addJellyfinServer} disabled={!newJellyfin.url || !newJellyfin.username || !newJellyfin.password} className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-purple-500/20 text-purple-400 disabled:opacity-30">Verbinden</button>
            </div>
          </div>
        )}

        {/* Jellyfin Sync */}
        {jellyfinServers.length > 0 && (
          <div className="pt-3 mt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/50">Jellyfin synchronisieren</p>
              <button
                onClick={async () => {
                  setJellyfinSyncResult({ loading: true })
                  try {
                    await api.post('/jellyfin/sync')
                    const poll = setInterval(async () => {
                      const s = await api.get('/jellyfin/sync/status')
                      setJellyfinSyncResult({ ...s.data, loading: s.data.running })
                      if (!s.data.running) clearInterval(poll)
                    }, 2000)
                  } catch { setJellyfinSyncResult({ error: 'Fehler' }) }
                }}
                disabled={jellyfinSyncResult?.loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-purple-500/20 text-purple-400 disabled:opacity-50"
              >
                <HiArrowPath className={`w-3.5 h-3.5 ${jellyfinSyncResult?.loading ? 'animate-spin' : ''}`} />
                {jellyfinSyncResult?.loading ? 'Synce...' : 'Jetzt syncen'}
              </button>
            </div>
            {jellyfinSyncResult && !jellyfinSyncResult.loading && (jellyfinSyncResult.added !== undefined || jellyfinSyncResult.error) && (
              <div className={`p-2.5 rounded-xl text-xs mt-1.5 ${jellyfinSyncResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                {jellyfinSyncResult.error || `${jellyfinSyncResult.added} neu, ${jellyfinSyncResult.updated} aktualisiert`}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Export / Import */}
      <section className="glass p-6">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Daten</h2>

        <div className="flex gap-3">
          {/* Export */}
          <button
            onClick={async () => {
              try {
                const res = await api.get('/watchlist/export')
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `watchlist-export-${user?.username}-${new Date().toISOString().slice(0,10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              } catch {}
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-white/[0.06] text-white/60 active:bg-white/[0.1]"
          >
            Export (JSON)
          </button>

          {/* Import */}
          <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-white/[0.06] text-white/60 active:bg-white/[0.1] cursor-pointer">
            Import (JSON)
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const data = JSON.parse(text)
                  const res = await api.post('/watchlist/import', data)
                  alert(`Import: ${res.data.imported_movies} Filme/Serien importiert, ${res.data.imported_watchlists} Watchlisten, ${res.data.skipped_duplicates} übersprungen`)
                } catch (err) {
                  alert(err.response?.data?.detail || 'Import fehlgeschlagen')
                }
                e.target.value = ''
              }}
            />
          </label>
        </div>

        <p className="text-[10px] text-white/20 mt-2">Export enthält: alle Watchlisten, Filme/Serien mit Status, Bewertungen, Tags, Notizen, Watch-Progress, Freundesliste</p>

        {/* Admin Full Export/Import */}
        {user?.is_admin && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-amber-400/70 font-medium mb-2">Admin: Server-Konfiguration</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    const res = await api.get('/admin/export')
                    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `admin-config-${new Date().toISOString().slice(0,10)}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch {}
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-400 active:bg-amber-500/20"
              >
                Config Export
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-400 active:bg-amber-500/20 cursor-pointer">
                Config Import
                <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const data = JSON.parse(await file.text())
                    const res = await api.post('/admin/import', data)
                    const r = res.data
                    alert(`Import: Sonarr=${r.sonarr} Radarr=${r.radarr} Plex=${r.plex} Jellyfin=${r.jellyfin} Tautulli=${r.tautulli} Profile=${r.profiles} Settings=${r.settings}`)
                    window.location.reload()
                  } catch (err) { alert(err.response?.data?.detail || 'Import fehlgeschlagen') }
                  e.target.value = ''
                }} />
              </label>
            </div>
            <p className="text-[10px] text-white/20 mt-1.5">Alle Server (Sonarr, Radarr, Plex, Jellyfin, Tautulli) + Download-Profile + Settings. Tokens werden verschlüsselt.</p>
          </div>
        )}
      </section>

      {/* API Keys */}
      <section className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> API Keys (MCP)
          </h2>
          <button
            onClick={() => setShowAddKey(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-cyan-400 bg-cyan-500/10 active:bg-cyan-500/20"
          >
            <HiPlus className="w-3.5 h-3.5" /> Neuer Key
          </button>
        </div>

        <p className="text-[11px] text-white/30 mb-3">
          API Keys für MCP-Zugriff (Claude, Cursor etc.). Endpoints: <code className="text-cyan-400/50">/mcp/message</code> (HTTP) · <code className="text-cyan-400/50">/sse</code> (SSE)
        </p>

        {apiKeys.map(k => (
          <div key={k.id} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl mb-2">
            <div>
              <p className="text-sm font-medium text-white/70">{k.name}</p>
              <p className="text-[11px] text-white/30 font-mono">{k.key_preview}</p>
              {k.last_used && <p className="text-[10px] text-white/20">Zuletzt: {new Date(k.last_used).toLocaleDateString('de-DE')}</p>}
            </div>
            <button
              onClick={async () => { try { await api.delete(`/admin/api-keys/${k.id}`); loadApiKeys() } catch {} }}
              className="px-2 py-1 rounded-lg text-[10px] bg-red-500/10 text-red-400 active:bg-red-500/20"
            >
              <HiTrash className="w-3 h-3" />
            </button>
          </div>
        ))}

        {showNewKey && (
          <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl mb-2">
            <p className="text-xs text-green-400 font-medium mb-1">Key erstellt — jetzt kopieren! Wird nicht nochmal angezeigt.</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-green-300 bg-black/30 px-2 py-1 rounded flex-1 break-all font-mono">{showNewKey}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(showNewKey); }}
                className="px-2 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400 shrink-0"
              >
                Kopieren
              </button>
            </div>
          </div>
        )}

        {showAddKey && (
          <div className="bg-white/[0.03] p-3 rounded-xl space-y-2 mt-2">
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Name (z.B. Claude Desktop)"
              className="glass-input py-2 text-sm w-full"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowAddKey(false); setNewKeyName('') }} className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50">Abbrechen</button>
              <button
                onClick={async () => {
                  try {
                    const res = await api.post('/admin/api-keys', { name: newKeyName || 'MCP Key' })
                    setShowNewKey(res.data.key)
                    setShowAddKey(false)
                    setNewKeyName('')
                    loadApiKeys()
                  } catch {}
                }}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-cyan-500/20 text-cyan-400"
              >
                Erstellen
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full glass p-4 flex items-center justify-center gap-2 text-red-400 active:bg-red-500/10 transition-colors"
      >
        <HiArrowRightOnRectangle className="w-5 h-5" />
        Abmelden
      </button>
    </div>
  )
}
