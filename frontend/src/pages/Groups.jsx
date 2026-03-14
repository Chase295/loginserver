import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HiPlus, HiUserGroup, HiUserPlus } from 'react-icons/hi2'
import api from '../api/client'
import Modal from '../components/Modal'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(null)
  const [newName, setNewName] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = () => {
    api.get('/groups/').then(r => setGroups(r.data)).catch(() => {})
  }

  const createGroup = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await api.post('/groups/', { name: newName })
      setNewName('')
      setShowCreate(false)
      fetchGroups()
    } catch {}
  }

  const inviteMember = async (e) => {
    e.preventDefault()
    if (!inviteUsername.trim() || !showInvite) return
    try {
      await api.post(`/groups/${showInvite}/invite`, { username: inviteUsername })
      setInviteUsername('')
      setShowInvite(null)
      fetchGroups()
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gruppen</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <HiPlus className="w-4 h-4" /> Neue Gruppe
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <HiUserGroup className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p className="text-lg">Keine Gruppen</p>
          <p className="text-sm mt-1">Erstelle eine Gruppe um gemeinsam zu schauen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{group.name}</h3>
                <button
                  onClick={() => setShowInvite(group.id)}
                  className="glass-button p-2 rounded-lg"
                >
                  <HiUserPlus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.members?.map((m, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      m.status === 'accepted'
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'bg-white/5 text-white/30'
                    }`}
                  >
                    {m.username} {m.status === 'pending' && '(eingeladen)'}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Neue Gruppe">
        <form onSubmit={createGroup} className="space-y-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Gruppenname"
            className="glass-input"
            required
          />
          <button type="submit" className="btn-primary w-full">Erstellen</button>
        </form>
      </Modal>

      {/* Invite Modal */}
      <Modal open={!!showInvite} onClose={() => setShowInvite(null)} title="Mitglied einladen">
        <form onSubmit={inviteMember} className="space-y-4">
          <input
            type="text"
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            placeholder="Benutzername"
            className="glass-input"
            required
          />
          <button type="submit" className="btn-primary w-full">Einladen</button>
        </form>
      </Modal>
    </div>
  )
}
