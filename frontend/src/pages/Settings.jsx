import { useEffect, useState } from 'react'
import { HiArrowRightOnRectangle, HiEye, HiUserGroup, HiLockClosed } from 'react-icons/hi2'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Öffentlich', icon: HiEye, desc: 'Jeder kann deine Watchlist sehen' },
  { value: 'friends', label: 'Freunde', icon: HiUserGroup, desc: 'Nur Freunde können sehen' },
  { value: 'private', label: 'Privat', icon: HiLockClosed, desc: 'Nur du kannst sehen' },
]

export default function Settings() {
  const { user, logout } = useAuth()
  const [visibility, setVisibility] = useState('friends')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/watchlist/settings').then(r => setVisibility(r.data.visibility)).catch(() => {})
  }, [])

  const saveVisibility = async (val) => {
    setVisibility(val)
    try {
      await api.put('/watchlist/settings', { visibility: val })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
            <p className="text-lg font-semibold">{user?.username}</p>
            <p className="text-sm text-white/40">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* Visibility */}
      <section className="glass p-6">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">
          Watchlist Sichtbarkeit
          {saved && <span className="ml-2 text-green-400 normal-case">Gespeichert!</span>}
        </h2>
        <div className="space-y-2">
          {VISIBILITY_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => saveVisibility(value)}
              className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${
                visibility === value
                  ? 'bg-primary-500/15 border border-primary-400/30'
                  : 'glass-light hover:bg-white/[0.06]'
              }`}
            >
              <Icon className={`w-5 h-5 ${visibility === value ? 'text-primary-400' : 'text-white/40'}`} />
              <div className="text-left">
                <p className={`font-medium text-sm ${visibility === value ? 'text-primary-400' : ''}`}>{label}</p>
                <p className="text-xs text-white/30">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full glass p-4 flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <HiArrowRightOnRectangle className="w-5 h-5" />
        Abmelden
      </button>
    </div>
  )
}
