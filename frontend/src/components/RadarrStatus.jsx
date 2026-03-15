import { useEffect, useState, useRef } from 'react'
import {
  HiMagnifyingGlass, HiChevronDown, HiChevronUp, HiPlus, HiArrowPath,
  HiTrash, HiArrowDown, HiXMark, HiPencil, HiCheck,
} from 'react-icons/hi2'
import api from '../api/client'

function formatSize(bytes) {
  if (!bytes) return '-'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Release Search ───────────────────────────────────────────────
function ReleaseSearchPanel({ serverId, movieId, title, onClose }) {
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [grabbing, setGrabbing] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/radarr/servers/${serverId}/release`, { params: { movieId } })
      .then(r => setReleases(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Suche fehlgeschlagen'))
      .finally(() => setLoading(false))
  }, [])

  const grab = async (rel) => {
    setGrabbing(p => ({ ...p, [rel.guid]: true }))
    try {
      await api.post(`/radarr/servers/${serverId}/release`, { guid: rel.guid, indexerId: rel.indexerId })
      setGrabbing(p => ({ ...p, [rel.guid]: 'done' }))
    } catch {
      setGrabbing(p => ({ ...p, [rel.guid]: false }))
    }
  }

  return (
    <div className="mt-2 bg-[#161630] border border-blue-500/20 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border-b border-blue-500/10">
        <span className="text-xs text-blue-300 truncate flex-1 font-medium">Releases: {title}</span>
        <button onClick={onClose} className="p-1.5 text-white/40 active:text-white/80">
          <HiXMark className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2">
            <HiArrowPath className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-sm text-white/40">Suche Releases...</span>
          </div>
        )}
        {error && <p className="text-sm text-red-400 p-3">{error}</p>}
        {!loading && !error && releases.length === 0 && (
          <p className="text-sm text-white/40 p-4 text-center">Keine Releases gefunden</p>
        )}
        {!loading && releases.map((rel, i) => {
          const q = rel.quality?.quality?.name || '?'
          const g = grabbing[rel.guid]
          const isRejected = rel.rejected
          const langs = rel.languages?.map(l => l.name).filter(Boolean) || []
          const langStr = langs.length > 0 ? langs.join(', ') : null

          return (
            <div key={i} className={`flex gap-3 px-3 py-2.5 ${isRejected ? 'border-l-2 border-red-500/30' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 leading-relaxed break-all">{rel.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    q.includes('2160') || q.includes('4K') ? 'bg-purple-500/20 text-purple-300' :
                    q.includes('1080') ? 'bg-blue-500/20 text-blue-300' :
                    q.includes('720') ? 'bg-green-500/20 text-green-300' :
                    'bg-white/[0.08] text-white/50'
                  }`}>{q}</span>
                  {langStr && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium">{langStr}</span>
                  )}
                  <span className="text-xs text-white/40">{formatSize(rel.size)}</span>
                  {rel.seeders !== undefined && (
                    <span className={`text-xs ${rel.seeders > 5 ? 'text-green-400' : rel.seeders > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {rel.seeders} Seeds
                    </span>
                  )}
                  {rel.indexer && <span className="text-xs text-white/25">{rel.indexer}</span>}
                </div>
                {isRejected && rel.rejections?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rel.rejections.map((r, j) => (
                      <span key={j} className="text-[11px] text-red-400/70">{r}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => grab(rel)}
                disabled={g === true || g === 'done'}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 self-center ${
                  g === 'done' ? 'bg-green-500/20 text-green-400' :
                  isRejected ? 'bg-orange-500/15 text-orange-400 active:bg-orange-500/25' :
                  'bg-blue-500/20 text-blue-400 active:bg-blue-500/30'
                } disabled:opacity-40`}
              >
                {g === true ? <HiArrowPath className="w-5 h-5 animate-spin" /> :
                 g === 'done' ? <span className="text-xs font-medium">OK</span> :
                 <HiArrowDown className="w-5 h-5" />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ─── Main RadarrStatus Component ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

export default function RadarrStatus({ tmdbId, title }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [searching, setSearching] = useState({})

  // Expanded state
  const [showReleases, setShowReleases] = useState(false)
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [rootFolders, setRootFolders] = useState([])
  const [allTags, setAllTags] = useState([])
  const [saving, setSaving] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const queueInterval = useRef(null)

  // Add flow
  const [addStep, setAddStep] = useState('button')
  const [lookup, setLookup] = useState(null)
  const [addForm, setAddForm] = useState({ server_id: null, rootFolders: [], profiles: [], root_folder_path: '', quality_profile_id: null, minimum_availability: 'released' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)
  const [servers, setServers] = useState([])
  const [searchAfterAdd, setSearchAfterAdd] = useState(false)

  const loadStatus = () => {
    if (!tmdbId) return
    setLoading(true)
    api.get(`/radarr/status/${tmdbId}`)
      .then(r => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadStatus() }, [tmdbId])
  useEffect(() => () => clearInterval(queueInterval.current), [])

  const expand = async (serverId, radarrId) => {
    if (expanded === serverId) {
      setExpanded(null)
      clearInterval(queueInterval.current)
      return
    }
    setExpanded(serverId)
    setQueue([])
    setHistory([])
    setShowHistory(false)
    setShowEdit(false)
    setShowDelete(false)
    setShowReleases(false)

    try {
      const [qRes, hRes] = await Promise.all([
        api.get(`/radarr/servers/${serverId}/queue`).catch(() => ({ data: { records: [] } })),
        api.get(`/radarr/servers/${serverId}/history`, { params: { movieId: radarrId } }).catch(() => ({ data: [] })),
      ])
      const allQ = qRes.data?.records || []
      setQueue(allQ.filter(r => r.movieId === radarrId || r.movie?.id === radarrId))
      setHistory(Array.isArray(hRes.data) ? hRes.data : hRes.data?.records || [])
    } catch {}

    clearInterval(queueInterval.current)
    queueInterval.current = setInterval(() => {
      api.get(`/radarr/servers/${serverId}/queue`)
        .then(r => {
          const allQ = r.data?.records || []
          setQueue(allQ.filter(r => r.movieId === radarrId || r.movie?.id === radarrId))
        })
        .catch(() => {})
    }, 5000)
  }

  const triggerSearch = async (serverId, radarrId) => {
    setSearching(p => ({ ...p, [serverId]: true }))
    try { await api.post(`/radarr/servers/${serverId}/command`, { name: 'MoviesSearch', movieIds: [radarrId] }) } catch {}
    setTimeout(() => setSearching(p => ({ ...p, [serverId]: false })), 3000)
  }

  const removeFromQueue = async (serverId, queueId) => {
    try {
      await api.delete(`/radarr/servers/${serverId}/queue/${queueId}`)
      setQueue(prev => prev.filter(q => q.id !== queueId))
    } catch {}
  }

  const openEdit = async (serverId, srv) => {
    setShowEdit(true)
    setShowDelete(false)
    try {
      const [pRes, mRes, fRes, tRes] = await Promise.all([
        api.get(`/radarr/servers/${serverId}/profiles`),
        api.get(`/radarr/servers/${serverId}/movie/${srv.radarr_id}`),
        api.get(`/radarr/servers/${serverId}/rootfolders`),
        api.get(`/radarr/servers/${serverId}/tags`).catch(() => ({ data: [] })),
      ])
      setProfiles(pRes.data)
      setRootFolders(fRes.data)
      setAllTags(tRes.data)
      setEditForm({
        monitored: mRes.data.monitored,
        qualityProfileId: mRes.data.qualityProfileId,
        minimumAvailability: mRes.data.minimumAvailability || 'released',
        path: mRes.data.path || '',
        tags: mRes.data.tags || [],
      })
    } catch {}
  }

  const saveEdit = async (serverId, radarrId) => {
    setSaving(true)
    try {
      await api.put(`/radarr/servers/${serverId}/movie/${radarrId}`, editForm)
      setShowEdit(false)
      loadStatus()
    } catch {}
    setSaving(false)
  }

  const doDelete = async (serverId, radarrId) => {
    setDeleting(true)
    try {
      await api.delete(`/radarr/servers/${serverId}/movie/${radarrId}`, { params: { delete_files: deleteFiles } })
      setShowDelete(false)
      setExpanded(null)
      clearInterval(queueInterval.current)
      loadStatus()
    } catch {}
    setDeleting(false)
  }

  // ─── Add flow ──────────────────────────────────────────────────
  const startAdd = async () => {
    setAddStep('loading')
    setAddError(null)
    try {
      const res = await api.get('/radarr/servers')
      setServers(res.data)
      if (res.data.length === 1) {
        await pickServer(res.data[0].id)
      } else {
        setAddStep('server')
      }
    } catch {
      setAddStep('button')
    }
  }

  const pickServer = async (serverId) => {
    setAddForm(p => ({ ...p, server_id: serverId }))
    setAddStep('loading')
    try {
      const [folders, profs, lookupRes] = await Promise.all([
        api.get(`/radarr/servers/${serverId}/rootfolders`),
        api.get(`/radarr/servers/${serverId}/profiles`),
        api.get(`/radarr/servers/${serverId}/lookup/${tmdbId}`),
      ])
      setAddForm(p => ({
        ...p, server_id: serverId,
        rootFolders: folders.data, profiles: profs.data,
        root_folder_path: folders.data[0]?.path || '',
        quality_profile_id: profs.data[0]?.id || null,
      }))
      setLookup(lookupRes.data)
      setAddStep('preview')
    } catch (e) {
      setAddError(e.response?.data?.detail || 'Film konnte nicht gefunden werden')
      setAddStep('button')
    }
  }

  const doAdd = async () => {
    if (!addForm.server_id || !addForm.root_folder_path || !addForm.quality_profile_id) return
    setAddLoading(true)
    setAddError(null)
    try {
      await api.post(`/radarr/servers/${addForm.server_id}/add`, {
        tmdb_id: tmdbId, title,
        root_folder_path: addForm.root_folder_path,
        quality_profile_id: addForm.quality_profile_id,
        minimum_availability: addForm.minimum_availability,
        search_after_add: searchAfterAdd,
      })
      setAddStep('button')
      loadStatus()
    } catch (e) {
      setAddError(e.response?.data?.detail || 'Hinzufügen fehlgeschlagen')
    }
    setAddLoading(false)
  }

  // ─── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-white/40">Radarr...</span>
      </div>
    )
  }

  if (!status) return null

  const eventLabels = { grabbed: 'Grabbed', downloadFolderImported: 'Importiert', movieFileDeleted: 'Gelöscht', downloadFailed: 'Fehler' }

  // ─── Movie FOUND ───────────────────────────────────────────────
  if (status.found && status.servers?.length > 0) {
    return (
      <div className="space-y-2">
        {status.servers.map(srv => {
          const isExpanded = expanded === srv.server_id
          return (
            <div key={srv.server_id} className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                  <span className="text-sm font-medium text-orange-300">{srv.server_name}</span>
                </div>
                <button onClick={() => expand(srv.server_id, srv.radarr_id)} className="p-2 rounded-lg text-white/40 active:bg-white/[0.08]">
                  {isExpanded ? <HiChevronUp className="w-4 h-4" /> : <HiChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                {srv.hasFile ? (
                  <>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium flex items-center gap-1">
                      <HiCheck className="w-3 h-3" /> Vorhanden
                    </span>
                    {srv.quality && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{srv.quality}</span>}
                    <span className="text-xs text-white/30">{srv.size_gb} GB</span>
                  </>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                    {srv.monitored ? 'Fehlt — Monitored' : 'Fehlt'}
                  </span>
                )}
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-3">
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => triggerSearch(srv.server_id, srv.radarr_id)}
                      disabled={searching[srv.server_id]}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-orange-500/20 text-orange-400 active:bg-orange-500/30 disabled:opacity-50"
                    >
                      {searching[srv.server_id] ? <HiArrowPath className="w-4 h-4 animate-spin" /> : <HiMagnifyingGlass className="w-4 h-4" />}
                      Auto-Suche
                    </button>
                    <button
                      onClick={() => setShowReleases(!showReleases)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium ${showReleases ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.06] text-white/50 active:bg-white/[0.1]'}`}
                    >
                      <HiMagnifyingGlass className="w-4 h-4" /> Releases
                    </button>
                    <button
                      onClick={() => openEdit(srv.server_id, srv)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs ${showEdit ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.06] text-white/50 active:bg-white/[0.1]'}`}
                    >
                      <HiPencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setShowDelete(!showDelete); setShowEdit(false) }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs ${showDelete ? 'bg-red-500/20 text-red-400' : 'bg-red-500/10 text-red-400/60 active:bg-red-500/20'}`}
                    >
                      <HiTrash className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Edit */}
                  {showEdit && editForm && (
                    <div className="p-3 bg-white/[0.04] border border-white/[0.08] rounded-xl space-y-3">
                      <p className="text-xs font-medium text-white/50">Film bearbeiten</p>
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Quality Profile</label>
                        <select value={editForm.qualityProfileId || ''} onChange={e => setEditForm(p => ({ ...p, qualityProfileId: Number(e.target.value) }))} className="glass-input py-2 text-sm w-full">
                          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Minimum Availability</label>
                        <select value={editForm.minimumAvailability} onChange={e => setEditForm(p => ({ ...p, minimumAvailability: e.target.value }))} className="glass-input py-2 text-sm w-full">
                          <option value="announced">Announced</option>
                          <option value="inCinemas">In Cinemas</option>
                          <option value="released">Released</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Speicherort</label>
                        <input value={editForm.path} onChange={e => setEditForm(p => ({ ...p, path: e.target.value }))} className="glass-input py-2 text-sm w-full" />
                        {rootFolders.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {rootFolders.map(f => (
                              <button key={f.path} onClick={() => { const folder = editForm.path.split('/').pop(); setEditForm(p => ({ ...p, path: `${f.path}/${folder}` })) }}
                                className={`text-[11px] px-2 py-1 rounded-lg ${editForm.path.startsWith(f.path) ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/[0.06] text-white/40 active:bg-white/[0.1]'}`}>
                                {f.path} ({f.free_space_gb} GB)
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {allTags.length > 0 && (
                        <div>
                          <label className="text-xs text-white/40 block mb-1">Tags</label>
                          <div className="flex flex-wrap gap-1.5">
                            {allTags.map(tag => {
                              const sel = editForm.tags.includes(tag.id)
                              return (
                                <button key={tag.id} onClick={() => setEditForm(p => ({ ...p, tags: sel ? p.tags.filter(t => t !== tag.id) : [...p.tags, tag.id] }))}
                                  className={`text-xs px-2.5 py-1 rounded-lg ${sel ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/[0.06] text-white/40'}`}>
                                  {tag.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setShowEdit(false)} className="flex-1 px-3 py-2 rounded-xl text-sm bg-white/[0.06] text-white/50">Abbrechen</button>
                        <button onClick={() => saveEdit(srv.server_id, srv.radarr_id)} disabled={saving} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-orange-500/20 text-orange-400 disabled:opacity-30">
                          {saving ? 'Speichere...' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete */}
                  {showDelete && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                      <p className="text-sm text-red-400 font-medium">"{title}" aus Radarr entfernen?</p>
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input type="checkbox" checked={deleteFiles} onChange={e => setDeleteFiles(e.target.checked)} className="rounded border-red-500/30 bg-red-500/10 w-4 h-4" />
                        <span className="text-sm text-red-400/80">Dateien auch löschen ({srv.size_gb} GB)</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setShowDelete(false)} className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50">Nein</button>
                        <button onClick={() => doDelete(srv.server_id, srv.radarr_id)} disabled={deleting} className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 disabled:opacity-30">
                          {deleting ? 'Lösche...' : 'Ja, löschen'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Releases */}
                  {showReleases && (
                    <ReleaseSearchPanel serverId={srv.server_id} movieId={srv.radarr_id} title={title} onClose={() => setShowReleases(false)} />
                  )}

                  {/* Queue */}
                  {queue.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 font-medium mb-1.5">Downloads ({queue.length})</p>
                      {queue.map(item => {
                        const progress = item.sizeleft && item.size ? Math.round((1 - item.sizeleft / item.size) * 100) : 0
                        return (
                          <div key={item.id} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/70 truncate">{item.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">{item.quality?.quality?.name || '?'}</span>
                                  <span className="text-xs text-white/40">{formatSize(item.size)}</span>
                                  {item.timeleft && <span className="text-xs text-white/30">ETA: {item.timeleft}</span>}
                                </div>
                              </div>
                              <button onClick={() => removeFromQueue(srv.server_id, item.id)} className="p-2 text-white/30 active:text-red-400"><HiXMark className="w-4 h-4" /></button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-white/40 w-10 text-right">{progress}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* History */}
                  {history.length > 0 && (
                    <div>
                      <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-xs text-white/40 active:text-white/60 py-1">
                        {showHistory ? <HiChevronUp className="w-4 h-4" /> : <HiChevronDown className="w-4 h-4" />}
                        Verlauf ({history.length})
                      </button>
                      {showHistory && (
                        <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto">
                          {history.slice(0, 20).map((item, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03]">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${
                                item.eventType === 'downloadFolderImported' ? 'bg-green-400' :
                                item.eventType === 'grabbed' ? 'bg-blue-400' :
                                'bg-red-400'
                              }`} />
                              <span className="text-xs text-white/50 flex-1">{eventLabels[item.eventType] || item.eventType}</span>
                              <span className="text-xs text-white/25">{formatDate(item.date)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Movie NOT FOUND — Add flow ────────────────────────────────
  if (addStep === 'loading') {
    return (
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
        <div className="flex items-center justify-center gap-2">
          <HiArrowPath className="w-5 h-5 text-orange-400 animate-spin" />
          <span className="text-sm text-white/50">Film wird gesucht...</span>
        </div>
      </div>
    )
  }

  if (addStep === 'server') {
    return (
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-orange-300">Server wählen</p>
          <button onClick={() => setAddStep('button')} className="p-1.5 text-white/40"><HiXMark className="w-4 h-4" /></button>
        </div>
        {servers.map(s => (
          <button key={s.id} onClick={() => pickServer(s.id)} className="w-full text-left px-3 py-2.5 rounded-xl bg-white/[0.06] text-sm text-white/70 active:bg-white/[0.1]">
            {s.name}
          </button>
        ))}
      </div>
    )
  }

  if (addStep === 'preview' && lookup) {
    const poster = lookup.images?.find(i => i.coverType === 'poster')
    const posterUrl = poster?.remoteUrl || poster?.url
    return (
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-orange-300">Film hinzufügen</p>
          <button onClick={() => setAddStep('button')} className="p-1.5 text-white/40"><HiXMark className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-3">
          {posterUrl && <img src={posterUrl} alt={lookup.title} className="w-16 h-24 rounded-lg object-cover shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{lookup.title}</p>
            <p className="text-xs text-white/40 mt-0.5">{lookup.year} {lookup.studio ? `· ${lookup.studio}` : ''} {lookup.runtime ? `· ${lookup.runtime} Min.` : ''}</p>
            {lookup.genres?.length > 0 && <p className="text-xs text-white/30 mt-0.5">{lookup.genres.slice(0, 3).join(', ')}</p>}
            {lookup.overview && <p className="text-xs text-white/40 mt-1 line-clamp-2">{lookup.overview}</p>}
          </div>
        </div>

        <div className="space-y-2.5 pt-1 border-t border-white/[0.06]">
          <div>
            <label className="text-xs text-white/40 block mb-1">Speicherort</label>
            <select value={addForm.root_folder_path} onChange={e => setAddForm(p => ({ ...p, root_folder_path: e.target.value }))} className="glass-input py-2 text-sm w-full">
              {addForm.rootFolders.map(f => <option key={f.path} value={f.path}>{f.path} ({f.free_space_gb} GB frei)</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Quality Profile</label>
            <select value={addForm.quality_profile_id || ''} onChange={e => setAddForm(p => ({ ...p, quality_profile_id: Number(e.target.value) }))} className="glass-input py-2 text-sm w-full">
              {addForm.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1">Minimum Availability</label>
            <select value={addForm.minimum_availability} onChange={e => setAddForm(p => ({ ...p, minimum_availability: e.target.value }))} className="glass-input py-2 text-sm w-full">
              <option value="announced">Announced</option>
              <option value="inCinemas">In Cinemas</option>
              <option value="released">Released</option>
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input type="checkbox" checked={searchAfterAdd} onChange={e => setSearchAfterAdd(e.target.checked)} className="rounded border-white/20 bg-white/[0.06] w-4 h-4" />
            <span className="text-sm text-white/60">Nach dem Hinzufügen automatisch suchen</span>
          </label>
        </div>

        {addError && <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded-xl">{addError}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={() => setAddStep('button')} className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-white/[0.06] text-white/50">Abbrechen</button>
          <button onClick={doAdd} disabled={addLoading || !addForm.quality_profile_id} className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium bg-orange-500/20 text-orange-400 disabled:opacity-30">
            {addLoading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={startAdd} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20 active:bg-orange-500/25 transition-all">
      <HiPlus className="w-4 h-4" />
      Zu Radarr hinzufügen
    </button>
  )
}
