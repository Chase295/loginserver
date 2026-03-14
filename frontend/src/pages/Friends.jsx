import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiUserPlus, HiCheck, HiXMark, HiChevronRight, HiHeart } from 'react-icons/hi2'
import api from '../api/client'
import Modal from '../components/Modal'

export default function Friends() {
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [users, setUsers] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [searchUser, setSearchUser] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = () => {
    api.get('/friends/list').then(r => setFriends(r.data)).catch(() => {})
    api.get('/friends/requests').then(r => setRequests(r.data)).catch(() => {})
  }

  const openAddModal = async () => {
    try {
      const res = await api.get('/friends/users')
      setUsers(res.data)
    } catch {}
    setShowAdd(true)
  }

  const sendRequest = async (username) => {
    try {
      await api.post('/friends/request', { receiver_username: username })
      setShowAdd(false)
      fetchAll()
    } catch {}
  }

  const respondRequest = async (id, action) => {
    try {
      await api.post('/friends/respond', { request_id: id, action })
      fetchAll()
    } catch {}
  }

  const removeFriend = async (id) => {
    try {
      await api.post('/friends/delete', { friend_id: id })
      fetchAll()
    } catch {}
  }

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchUser.toLowerCase()) &&
    !friends.some(f => f.user_id === u.id)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Freunde</h1>
        <button onClick={openAddModal} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <HiUserPlus className="w-4 h-4" /> Hinzufügen
        </button>
      </div>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">
            Anfragen ({requests.length})
          </h2>
          <div className="space-y-2">
            {requests.map(req => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{req.sender_username}</p>
                  <p className="text-xs text-white/40">möchte dein Freund sein</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondRequest(req.id, 'accept')}
                    className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/30 transition-colors"
                  >
                    <HiCheck className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => respondRequest(req.id, 'reject')}
                    className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-colors"
                  >
                    <HiXMark className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
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
              <Link
                key={friend.id}
                to={`/friends/${friend.username}`}
                className="glass p-4 flex items-center justify-between group hover:border-primary-400/30 transition-colors block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center font-bold text-sm">
                    {friend.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{friend.username}</p>
                    {friend.friendship_level && (
                      <p className="text-xs text-primary-400/60">
                        {friend.friendship_level}
                        {friend.level_confirmed && ' ✓'}
                      </p>
                    )}
                  </div>
                </div>
                <HiChevronRight className="w-5 h-5 text-white/20 group-hover:text-white/50 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </section>

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
          {filteredUsers.map(u => (
            <div key={u.id} className="glass-light p-3 flex items-center justify-between rounded-xl">
              <span className="font-medium">{u.username}</span>
              <button onClick={() => sendRequest(u.username)} className="btn-primary px-3 py-1.5 text-xs">
                Anfragen
              </button>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <p className="text-center text-white/30 py-4 text-sm">Keine Benutzer gefunden</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
