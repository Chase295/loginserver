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
        <header className="shrink-0 glass-nav border-b border-white/[0.04] px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-xl" />
              <h1 className="text-lg font-bold gradient-text">Watchlist</h1>
            </div>
            <div className="flex items-center gap-2.5">
              {user?.plex_avatar ? (
                <img src={user.plex_avatar} alt="" className="w-7 h-7 rounded-full ring-1 ring-white/10" />
              ) : null}
              <span className="text-sm text-white/40 font-medium">{user?.username}</span>
            </div>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Outlet />
          </div>
        </main>

        {/* Bottom nav - always at bottom, never moves */}
        <nav className="shrink-0 glass-nav border-t border-white/[0.04]"
             style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex justify-around px-2 py-2.5">
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
        <nav className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-6 gap-5 glass-nav border-r border-white/[0.04] z-50">
          <img src="/icon-192.png" alt="Watchlist" className="w-10 h-10 rounded-2xl mb-4 shadow-lg shadow-primary-500/20" />
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
