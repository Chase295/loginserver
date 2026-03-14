import { NavLink, Outlet } from 'react-router-dom'
import { HiHome, HiFilm, HiMagnifyingGlass, HiUserGroup, HiCog6Tooth } from 'react-icons/hi2'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', icon: HiHome, label: 'Home', end: true },
  { to: '/watchlist', icon: HiFilm, label: 'Watchlist' },
  { to: '/discover', icon: HiMagnifyingGlass, label: 'Entdecken' },
  { to: '/friends', icon: HiUserGroup, label: 'Freunde' },
  { to: '/settings', icon: HiCog6Tooth, label: 'Mehr' },
]

export default function Layout() {
  const { user } = useAuth()

  return (
    <>
      {/* Mobile: flex column fills viewport, content scrolls inside */}
      <div className="md:hidden flex flex-col h-[100dvh] overflow-hidden">
        {/* Header */}
        <header className="shrink-0 glass-nav border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold gradient-text">Watchlist</h1>
            <span className="text-sm text-white/50">{user?.username}</span>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Outlet />
          </div>
        </main>

        {/* Bottom nav - always at bottom, never moves */}
        <nav className="shrink-0 glass-nav border-t border-white/[0.06]"
             style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex justify-around px-1 py-2">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {/* Desktop: sidebar layout (unchanged) */}
      <div className="hidden md:block min-h-screen pl-20">
        <nav className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-6 gap-6 glass-nav border-r border-white/[0.06] z-50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center font-bold text-sm mb-4">
            W
          </div>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <Outlet />
        </main>
      </div>
    </>
  )
}
