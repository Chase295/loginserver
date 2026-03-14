import { NavLink, Outlet } from 'react-router-dom'
import { HiHome, HiFilm, HiMagnifyingGlass, HiUserGroup, HiCog6Tooth } from 'react-icons/hi2'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', icon: HiHome, label: 'Home', end: true },
  { to: '/watchlist', icon: HiFilm, label: 'Watchlist' },
  { to: '/discover', icon: HiMagnifyingGlass, label: 'Entdecken' },
  { to: '/friends', icon: HiUserGroup, label: 'Freunde' },
  { to: '/settings', icon: HiCog6Tooth, label: 'Settings' },
]

export default function Layout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-20">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 glass border-t-0 border-x-0 rounded-none px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold gradient-text">Watchlist</h1>
          <span className="text-sm text-white/50">{user?.username}</span>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-20 flex-col items-center py-6 gap-6 glass rounded-none border-t-0 border-b-0 border-l-0 z-50">
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass rounded-none border-b-0 border-x-0 flex justify-around px-2 py-1 safe-area-bottom">
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
      </nav>
    </div>
  )
}
