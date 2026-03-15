import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Watchlist from './pages/Watchlist'
import Discover from './pages/Discover'
import Friends from './pages/Friends'
import FriendWatchlist from './pages/FriendWatchlist'
import MatchLobby from './pages/MatchLobby'
import Settings from './pages/Settings'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/login" replace />
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="discover" element={<Discover />} />
        <Route path="friends" element={<Friends />} />
        <Route path="friends/:username" element={<FriendWatchlist />} />
        <Route path="match/:matchId" element={<MatchLobby />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
