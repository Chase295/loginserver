import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HiUserPlus, HiCheck, HiXMark, HiChevronRight, HiHeart, HiSparkles, HiTrash, HiClock, HiNoSymbol } from 'react-icons/hi2'
import api from '../api/client'
import Modal from '../components/Modal'

export default function Friends() {
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [users, setUsers] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [searchUser, setSearchUser] = useState('')
  const [matchInvitesReceived, setMatchInvitesReceived] = useState([])
  const [matchInvitesSent, setMatchInvitesSent] = useState([])
  const [activeMatches, setActiveMatches] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [sentRequests, setSentRequests] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = () => {
    api.get('/friends/list').then(r => setFriends(r.data)).catch(() => {})
    api.get('/friends/requests').then(r => setRequests(r.data)).catch(() => {})
    api.get('/friends/requests/sent').then(r => setSentRequests(r.data)).catch(() => {})
    api.get('/match/invites/received').then(r => setMatchInvitesReceived(r.data)).catch(() => {})
    api.get('/match/invites/sent').then(r => setMatchInvitesSent(r.data)).catch(() => {})
    api.get('/match/active').then(r => setActiveMatches(r.data)).catch(() => {})
  }

  const openAddModal = async () => {
    try {
      const [usersRes, sentRes] = await Promise.all([
        api.get('/friends/users'),
        api.get('/friends/requests/sent'),
      ])
      setUsers(usersRes.data)
      setSentRequests(sentRes.data)
    } catch {}
    setShowAdd(true)
  }

  const sendRequest = async (username) => {
    try {
      await api.post('/friends/request', { receiver_username: username })
      fetchAll()
    } catch {}
  }

  const cancelRequest = async (requestId) => {
    try {
      await api.delete(`/friends/request/${requestId}`)
      fetchAll()
    } catch {}
  }

  const respondRequest = async (id, action) => {
    try {
      await api.post('/friends/respond', { request_id: id, action })
      fetchAll()
    } catch {}
  }

  const sendMatchInvite = async (userId) => {
    try {
      await api.post('/match/invite', { receiver_id: userId })
      fetchAll()
    } catch {}
  }

  const respondMatchInvite = async (invId, action) => {
    try {
      const res = await api.post('/match/invite/respond', { invitation_id: invId, action })
      if (res.data.match_id) {
        navigate(`/match/${res.data.match_id}`)
      }
      fetchAll()
    } catch {}
  }

  const cancelMatchInvite = async (invId) => {
    try {
      await api.delete(`/match/invite/${invId}`)
      fetchAll()
    } catch {}
  }

  const deleteFriend = async (friendId) => {
    try {
      await api.post('/friends/delete', { friend_id: friendId })
      setConfirmDelete(null)
      fetchAll()
    } catch {}
  }

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchUser.toLowerCase()) &&
    !friends.some(f => f.user_id === u.id)
  )

  const hasPendingInviteTo = (userId) =>
    matchInvitesSent.some(i => i.receiver_id === userId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Freunde</h1>
        <button onClick={openAddModal} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <HiUserPlus className="w-4 h-4" /> Hinzufügen
        </button>
      </div>

      {/* Active Matches */}
      {activeMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Matches ({activeMatches.length})
          </h2>
          <div className="space-y-2">
            {activeMatches.map(match => (
              <Link
                key={match.id}
                to={`/match/${match.id}`}
                className="glass p-4 flex items-center justify-between active:scale-[0.98] transition-transform block"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    match.status === 'lobby'
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                      : 'bg-gradient-to-br from-pink-500 to-rose-500'
                  }`}>
                    <HiSparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{match.player1_username} & {match.player2_username}</p>
                    <p className={`text-xs ${match.status === 'lobby' ? 'text-amber-400/60' : 'text-green-400/60'}`}>
                      {match.status === 'lobby' ? 'In der Lobby' : 'Match läuft'}
                    </p>
                  </div>
                </div>
                <HiChevronRight className="w-5 h-5 text-white/20" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Match Invites Received */}
      {matchInvitesReceived.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Match-Einladungen ({matchInvitesReceived.length})
          </h2>
          <div className="space-y-2">
            {matchInvitesReceived.map(inv => (
              <div key={inv.id} className="glass p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                    <HiSparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{inv.sender_username}</p>
                    <p className="text-xs text-white/40">möchte matchen</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondMatchInvite(inv.id, 'accept')}
                    className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <HiCheck className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => respondMatchInvite(inv.id, 'reject')}
                    className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <HiXMark className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friend Requests */}
      {requests.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Freundschaftsanfragen ({requests.length})
          </h2>
          <div className="space-y-2">
            {requests.map(req => (
              <div key={req.id} className="glass p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{req.sender_username}</p>
                  <p className="text-xs text-white/40">möchte dein Freund sein</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondRequest(req.id, 'accept')}
                    className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <HiCheck className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => respondRequest(req.id, 'reject')}
                    className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <HiXMark className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sent Friend Requests */}
      {sentRequests.filter(r => r.status === 'pending').length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Gesendete Anfragen ({sentRequests.filter(r => r.status === 'pending').length})
          </h2>
          <div className="space-y-2">
            {sentRequests.filter(r => r.status === 'pending').map(req => (
              <div key={req.id} className="glass-light p-3 flex items-center justify-between rounded-xl">
                <div>
                  <p className="text-sm font-medium">{req.receiver_username}</p>
                  <p className="text-[11px] text-yellow-400/50 flex items-center gap-1">
                    <HiClock className="w-3 h-3" /> Wartet auf Antwort...
                  </p>
                </div>
                <button
                  onClick={() => cancelRequest(req.id)}
                  className="text-red-400/60 p-1.5 active:scale-90 transition-transform"
                  title="Anfrage zurückziehen"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends List */}
      <section>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
          Deine Freunde ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <HiHeart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Noch keine Freunde</p>
            <p className="text-sm mt-1">Füge Freunde hinzu um Watchlists zu teilen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map(friend => (
              <div key={friend.id} className="glass p-4 flex items-center gap-3">
                {/* Avatar + Info - clickable to watchlist */}
                <Link to={`/friends/${friend.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center font-bold text-sm">
                    {friend.username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{friend.username}</p>
                    {friend.friendship_level && (
                      <p className="text-xs text-primary-400/60">
                        {friend.friendship_level}
                        {friend.level_confirmed && ' ✓'}
                      </p>
                    )}
                  </div>
                </Link>

                {/* Match Button */}
                <button
                  onClick={() => !hasPendingInviteTo(friend.user_id) && sendMatchInvite(friend.user_id)}
                  disabled={hasPendingInviteTo(friend.user_id)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 ${
                    hasPendingInviteTo(friend.user_id)
                      ? 'bg-white/[0.04] text-white/20'
                      : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  }`}
                >
                  <HiSparkles className="w-3.5 h-3.5" />
                  {hasPendingInviteTo(friend.user_id) ? 'Eingeladen' : 'Matchen'}
                </button>

                {/* Delete friend */}
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(friend) }}
                  className="shrink-0 p-2 rounded-lg text-white/10 hover:text-red-400/60 hover:bg-red-500/10 transition-all active:scale-90"
                  title="Freundschaft beenden"
                >
                  <HiTrash className="w-4 h-4" />
                </button>

                {/* View watchlist */}
                <Link to={`/friends/${friend.username}`} className="shrink-0 text-white/20">
                  <HiChevronRight className="w-5 h-5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sent Match Invites */}
      {matchInvitesSent.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Gesendete Match-Einladungen
          </h2>
          <div className="space-y-2">
            {matchInvitesSent.map(inv => (
              <div key={inv.id} className="glass-light p-3 flex items-center justify-between rounded-xl">
                <div>
                  <p className="text-sm font-medium">{inv.receiver_username}</p>
                  <p className="text-[11px] text-white/30">Wartet auf Antwort...</p>
                </div>
                <button
                  onClick={() => cancelMatchInvite(inv.id)}
                  className="text-red-400/60 p-1.5 active:scale-90 transition-transform"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirm Delete Friend */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Freundschaft beenden">
        <div className="text-center space-y-4">
          <p className="text-white/70">
            Freundschaft mit <span className="font-semibold text-white">{confirmDelete?.username}</span> wirklich beenden?
          </p>
          <p className="text-xs text-white/30">Gemeinsame Matches und Einladungen werden ebenfalls entfernt.</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-5 py-2.5 rounded-xl bg-white/[0.06] text-white/60 text-sm font-medium active:scale-95 transition-transform"
            >
              Abbrechen
            </button>
            <button
              onClick={() => deleteFriend(confirmDelete?.id)}
              className="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium active:scale-95 transition-transform"
            >
              Beenden
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Friend Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Freund hinzufügen">
        <input
          type="text"
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          placeholder="Benutzer suchen..."
          className="glass-input mb-4"
        />
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {filteredUsers.map(u => {
            const sent = sentRequests.find(r => r.receiver_id === u.id)
            return (
              <div key={u.id} className="glass-light p-3 flex items-center justify-between rounded-xl">
                <span className="font-medium">{u.username}</span>
                {sent?.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-yellow-400/70 flex items-center gap-1">
                      <HiClock className="w-3.5 h-3.5" /> Wartet...
                    </span>
                    <button
                      onClick={() => cancelRequest(sent.id)}
                      className="p-1.5 rounded-lg text-red-400/60 hover:bg-red-500/10 active:scale-90 transition-all"
                      title="Anfrage zurückziehen"
                    >
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </div>
                ) : sent?.status === 'rejected' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400/60 flex items-center gap-1">
                      <HiNoSymbol className="w-3.5 h-3.5" /> Abgelehnt
                    </span>
                    <button onClick={() => sendRequest(u.username)} className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-white/50 text-xs active:scale-95 transition-transform">
                      Erneut
                    </button>
                  </div>
                ) : (
                  <button onClick={() => sendRequest(u.username)} className="btn-primary px-3 py-1.5 text-xs">
                    Anfragen
                  </button>
                )}
              </div>
            )
          })}
          {filteredUsers.length === 0 && (
            <p className="text-center text-white/30 py-4 text-sm">Keine Benutzer gefunden</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
