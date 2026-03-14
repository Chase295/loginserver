import { HiArrowRightOnRectangle } from 'react-icons/hi2'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { user, logout } = useAuth()

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
