import { useEffect, useState } from 'react'
import { HiArrowRightOnRectangle, HiShieldCheck, HiUsers, HiServer } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user, logout } = useAuth()
  const [adminStats, setAdminStats] = useState(null)
  const [adminUsers, setAdminUsers] = useState([])
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    if (user?.is_admin) {
      api.get('/admin/stats').then(r => setAdminStats(r.data)).catch(() => {})
    }
  }, [user])

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

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      {/* Profile */}
      <section className="glass p-6">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Profil</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold flex items-center gap-2">
              {user?.username}
              {user?.is_admin && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-lg">Admin</span>
              )}
            </p>
            <p className="text-sm text-white/40">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* Admin Section */}
      {user?.is_admin && (
        <section className="glass p-6">
          <h2 className="text-sm font-medium text-amber-400/70 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiShieldCheck className="w-4 h-4" /> Admin-Bereich
          </h2>

          {/* Stats */}
          {adminStats && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Benutzer', value: adminStats.users, icon: HiUsers },
                { label: 'Filme', value: adminStats.movies, icon: '🎬' },
                { label: 'Listen', value: adminStats.watchlists, icon: '📋' },
              ].map(({ label, value, icon: Icon }) => (
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
            <div className="space-y-1.5 mt-3">
              {adminUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {u.username}
                      {u.is_admin && <span className="text-[10px] text-amber-400">Admin</span>}
                    </p>
                    <p className="text-[11px] text-white/30">{u.email}</p>
                  </div>
                  {u.id !== user.id && (
                    <button
                      onClick={() => toggleUserAdmin(u.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                        u.is_admin
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {u.is_admin ? 'Admin entfernen' : 'Zum Admin'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Future Integrations */}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Integrationen (bald)</p>
            {[
              { name: 'Sonarr', desc: 'Serien automatisch laden', icon: '📺' },
              { name: 'Radarr', desc: 'Filme automatisch laden', icon: '🎬' },
              { name: 'Plex', desc: 'Mediathek verbinden', icon: '▶️' },
            ].map(({ name, desc, icon }) => (
              <div key={name} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl mb-1.5 opacity-50">
                <span className="text-xl">{icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-[11px] text-white/30">{desc}</p>
                </div>
                <span className="text-[10px] text-white/20 bg-white/[0.04] px-2 py-0.5 rounded">Bald</span>
              </div>
            ))}
          </div>
        </section>
      )}

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
