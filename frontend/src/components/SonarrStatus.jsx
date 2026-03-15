import { useEffect, useState, useRef } from 'react'
import {
  HiMagnifyingGlass, HiChevronDown, HiChevronUp, HiPlus, HiArrowPath,
  HiTrash, HiEye, HiEyeSlash, HiArrowDown, HiXMark, HiPencil,
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

// ─── Release Search (inline) ──────────────────────────────────────
function ReleaseSearchPanel({ serverId, episodeId, seriesId, seasonNumber, title, onClose }) {
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [grabbing, setGrabbing] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (episodeId) params.set('episodeId', episodeId)
    if (seriesId) params.set('seriesId', seriesId)
    if (seasonNumber !== undefined && seasonNumber !== null) params.set('seasonNumber', seasonNumber)
    api.get(`/sonarr/servers/${serverId}/release?${params}`)
      .then(r => setReleases(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Suche fehlgeschlagen'))
      .finally(() => setLoading(false))
  }, [])

  const grab = async (rel) => {
    setGrabbing(p => ({ ...p, [rel.guid]: true }))
    try {
      await api.post(`/sonarr/servers/${serverId}/release`, { guid: rel.guid, indexerId: rel.indexerId })
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
          // Extract languages
          const langs = rel.languages?.map(l => l.name).filter(Boolean) || []
          const langStr = langs.length > 0 ? langs.join(', ') : null
          // Extract source (WEBDL, Bluray, etc)
          const source = rel.quality?.quality?.source || ''

          return (
            <div key={i} className={`flex gap-3 px-3 py-2.5 ${isRejected ? 'border-l-2 border-red-500/30' : ''}`}>
              <div className="flex-1 min-w-0">
                {/* Release name */}
                <p className="text-xs text-white/70 leading-relaxed break-all">{rel.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {/* Quality */}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    q.includes('2160') || q.includes('4K') ? 'bg-purple-500/20 text-purple-300' :
                    q.includes('1080') ? 'bg-blue-500/20 text-blue-300' :
                    q.includes('720') ? 'bg-green-500/20 text-green-300' :
                    'bg-white/[0.08] text-white/50'
                  }`}>{q}</span>
                  {/* Language */}
                  {langStr && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium">
                      {langStr}
                    </span>
                  )}
                  {/* Size */}
                  <span className="text-xs text-white/40">{formatSize(rel.size)}</span>
                  {/* Source */}
                  {source && <span className="text-xs text-white/30">{source}</span>}
                  {/* Seeds */}
                  {rel.seeders !== undefined && (
                    <span className={`text-xs ${rel.seeders > 5 ? 'text-green-400' : rel.seeders > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {rel.seeders} Seeds
                    </span>
                  )}
                  {/* Indexer */}
                  {rel.indexer && <span className="text-xs text-white/25">{rel.indexer}</span>}
                </div>
                {/* Rejection reasons */}
                {isRejected && rel.rejections?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rel.rejections.map((r, j) => (
                      <span key={j} className="text-[11px] text-red-400/70">{r}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* Download button - ALWAYS clickable, even for rejected */}
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

// ─── Add Series Flow (multi-step) ─────────────────────────────────
function AddSeriesFlow({ tmdbId, title, showAdd, setShowAdd, addForm, setAddForm, addLoading, setAddLoading, addError, setAddError, servers, setServers, openAddForm, selectServer, submitAdd, loadStatus }) {
  const [step, setStep] = useState('button') // button → server → preview → config
  const [lookup, setLookup] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [searchAfterAdd, setSearchAfterAdd] = useState(false)

  const doLookup = async (serverId) => {
    setLookupLoading(true)
    setLookupError(null)
    try {
      const res = await api.get(`/sonarr/servers/${serverId}/lookup/${tmdbId}`)
      setLookup(res.data)
      setStep('preview')
    } catch (e) {
      setLookupError(e.response?.data?.detail || 'Serie konnte nicht gefunden werden')
    }
    setLookupLoading(false)
  }

  const startFlow = async () => {
    setStep('loading')
    setAddError(null)
    try {
      const res = await api.get('/sonarr/servers')
      setServers(res.data)
      if (res.data.length === 1) {
        // Single server → load config + lookup immediately
        const srv = res.data[0]
        setAddForm(p => ({ ...p, server_id: srv.id }))
        const [folders, profiles] = await Promise.all([
          api.get(`/sonarr/servers/${srv.id}/rootfolders`),
          api.get(`/sonarr/servers/${srv.id}/profiles`),
        ])
        setAddForm(p => ({
          ...p, server_id: srv.id,
          rootFolders: folders.data, profiles: profiles.data,
          root_folder_path: folders.data[0]?.path || '',
          quality_profile_id: profiles.data[0]?.id || null,
        }))
        await doLookup(srv.id)
      } else {
        setStep('server')
      }
    } catch {
      setLookupError('Server konnten nicht geladen werden')
      setStep('button')
    }
  }

  const pickServer = async (serverId) => {
    setAddForm(p => ({ ...p, server_id: serverId }))
    try {
      const [folders, profiles] = await Promise.all([
        api.get(`/sonarr/servers/${serverId}/rootfolders`),
        api.get(`/sonarr/servers/${serverId}/profiles`),
      ])
      setAddForm(p => ({
        ...p,
        rootFolders: folders.data, profiles: profiles.data,
        root_folder_path: folders.data[0]?.path || '',
        quality_profile_id: profiles.data[0]?.id || null,
      }))
    } catch {}
    await doLookup(serverId)
  }

  const doAdd = async () => {
    if (!addForm.server_id || !addForm.root_folder_path || !addForm.quality_profile_id) return
    setAddLoading(true)
    setAddError(null)
    try {
      await api.post(`/sonarr/servers/${addForm.server_id}/add`, {
        tmdb_id: tmdbId, title,
        root_folder_path: addForm.root_folder_path,
        quality_profile_id: addForm.quality_profile_id,
        monitor_strategy: addForm.monitor_strategy,
        search_after_add: searchAfterAdd,
      })
      setStep('button')
      loadStatus()
    } catch (e) {
      setAddError(e.response?.data?.detail || 'Hinzufügen fehlgeschlagen')
    }
    setAddLoading(false)
  }

  const close = () => {
    setStep('button')
    setLookup(null)
    setLookupError(null)
  }

  // ── Button ──
  if (step === 'button') {
    return (
      <div>
        <button
          onClick={startFlow}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 active:bg-blue-500/25 transition-all"
        >
          <HiPlus className="w-4 h-4" />
          Zu Sonarr hinzufügen
        </button>
        {lookupError && <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded-xl mt-2">{lookupError}</p>}
      </div>
    )
  }

  // ── Loading ──
  if (step === 'loading' || lookupLoading) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-center justify-center gap-2">
          <HiArrowPath className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-sm text-white/50">Serie wird gesucht...</span>
        </div>
      </div>
    )
  }

  // ── Server selection ──
  if (step === 'server') {
    return (
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-blue-300">Server wählen</p>
          <button onClick={close} className="p-1.5 text-white/40 active:text-white/70"><HiXMark className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1.5">
          {servers.map(s => (
            <button
              key={s.id}
              onClick={() => pickServer(s.id)}
              className="w-full text-left px-3 py-2.5 rounded-xl bg-white/[0.06] text-sm text-white/70 active:bg-white/[0.1]"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Preview + Config ──
  if (step === 'preview' && lookup) {
    const poster = lookup.images?.find(i => i.coverType === 'poster')
    const posterUrl = poster?.remoteUrl || poster?.url

    return (
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-blue-300">Serie hinzufügen</p>
          <button onClick={close} className="p-1.5 text-white/40 active:text-white/70"><HiXMark className="w-4 h-4" /></button>
        </div>

        {/* Serie-Info */}
        <div className="flex gap-3">
          {posterUrl && (
            <img src={posterUrl} alt={lookup.title} className="w-16 h-24 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{lookup.title}</p>
            <p className="text-xs text-white/40 mt-0.5">
              {lookup.year} {lookup.network ? `· ${lookup.network}` : ''} · {lookup.seriesType}
            </p>
            {lookup.genres?.length > 0 && (
              <p className="text-xs text-white/30 mt-0.5">{lookup.genres.slice(0, 3).join(', ')}</p>
            )}
            {lookup.overview && (
              <p className="text-xs text-white/40 mt-1 line-clamp-2">{lookup.overview}</p>
            )}
          </div>
        </div>

        {/* Staffeln-Übersicht */}
        <div>
          <p className="text-xs text-white/50 font-medium mb-1.5">Staffeln ({lookup.seasons?.filter(s => s.seasonNumber > 0).length})</p>
          <div className="space-y-1">
            {lookup.seasons?.filter(s => s.seasonNumber > 0).sort((a, b) => a.seasonNumber - b.seasonNumber).map(sn => (
              <div key={sn.seasonNumber} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04]">
                <span className="text-xs text-white/50 w-10 shrink-0">S{String(sn.seasonNumber).padStart(2, '0')}</span>
                <span className="text-xs text-white/40 flex-1">
                  {sn.statistics?.totalEpisodeCount || '?'} Episoden
                </span>
                <span className={`text-xs ${sn.monitored ? 'text-blue-400' : 'text-white/25'}`}>
                  {sn.monitored ? 'Monitored' : 'Unmonitored'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Konfiguration */}
        <div className="space-y-2.5 pt-1 border-t border-white/[0.06]">
          <p className="text-xs text-white/50 font-medium">Einstellungen</p>

          {/* Root folder */}
          <div>
            <label className="text-xs text-white/40 block mb-1">Speicherort</label>
            <select
              value={addForm.root_folder_path}
              onChange={e => setAddForm(p => ({ ...p, root_folder_path: e.target.value }))}
              className="glass-input py-2 text-sm w-full"
            >
              {addForm.rootFolders.map(f => (
                <option key={f.path} value={f.path}>{f.path} ({f.free_space_gb} GB frei)</option>
              ))}
            </select>
          </div>

          {/* Quality profile */}
          <div>
            <label className="text-xs text-white/40 block mb-1">Quality Profile</label>
            <select
              value={addForm.quality_profile_id || ''}
              onChange={e => setAddForm(p => ({ ...p, quality_profile_id: Number(e.target.value) }))}
              className="glass-input py-2 text-sm w-full"
            >
              {addForm.profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Monitoring strategy */}
          <div>
            <label className="text-xs text-white/40 block mb-1">Monitoring</label>
            <select
              value={addForm.monitor_strategy}
              onChange={e => setAddForm(p => ({ ...p, monitor_strategy: e.target.value }))}
              className="glass-input py-2 text-sm w-full"
            >
              <option value="none">Keine — manuell auswählen</option>
              <option value="all">Alle Episoden</option>
              <option value="future">Nur zukünftige</option>
              <option value="missing">Fehlende</option>
              <option value="pilot">Nur Pilot-Episode</option>
            </select>
          </div>

          {/* Search after add */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={searchAfterAdd}
              onChange={e => setSearchAfterAdd(e.target.checked)}
              className="rounded border-white/20 bg-white/[0.06] w-4 h-4"
            />
            <span className="text-sm text-white/60">Nach dem Hinzufügen automatisch suchen</span>
          </label>
        </div>

        {/* Error */}
        {addError && <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded-xl">{addError}</p>}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={close} className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-white/[0.06] text-white/50 active:bg-white/[0.1]">
            Abbrechen
          </button>
          <button
            onClick={doAdd}
            disabled={addLoading || !addForm.quality_profile_id}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium bg-blue-500/20 text-blue-400 active:bg-blue-500/30 disabled:opacity-30"
          >
            {addLoading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════
// ─── Main SonarrStatus Component ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

export default function SonarrStatus({ tmdbId, title }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [searching, setSearching] = useState({})

  // Expanded state
  const [episodes, setEpisodes] = useState([])
  const [epLoading, setEpLoading] = useState(false)
  const [epError, setEpError] = useState(null)
  const [expandedSeasons, setExpandedSeasons] = useState({})
  const [releaseSearch, setReleaseSearch] = useState(null)
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const queueInterval = useRef(null)

  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    server_id: null, rootFolders: [], profiles: [],
    root_folder_path: '', quality_profile_id: null, monitor_strategy: 'none',
  })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)
  const [servers, setServers] = useState([])

  const loadStatus = () => {
    if (!tmdbId) return
    setLoading(true)
    api.get(`/sonarr/status/${tmdbId}`)
      .then(r => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadStatus() }, [tmdbId])

  const expand = async (serverId, sonarrId) => {
    if (expanded === serverId) {
      setExpanded(null)
      clearInterval(queueInterval.current)
      return
    }
    setExpanded(serverId)
    setEpisodes([])
    setEpLoading(true)
    setEpError(null)
    setQueue([])
    setHistory([])
    setShowHistory(false)
    setShowEdit(false)
    setShowDelete(false)
    setReleaseSearch(null)
    setExpandedSeasons({})

    try {
      const [epRes, qRes, hRes] = await Promise.all([
        api.get(`/sonarr/servers/${serverId}/series/${sonarrId}/episodes`).catch(() => ({ data: [] })),
        api.get(`/sonarr/servers/${serverId}/queue`).catch(() => ({ data: { records: [] } })),
        api.get(`/sonarr/servers/${serverId}/history`, { params: { seriesId: sonarrId } }).catch(() => ({ data: [] })),
      ])
      setEpisodes(epRes.data)
      const allQ = qRes.data?.records || []
      setQueue(allQ.filter(r => r.seriesId === sonarrId || r.series?.id === sonarrId))
      setHistory(Array.isArray(hRes.data) ? hRes.data : hRes.data?.records || [])

      if (epRes.data.length > 0) {
        const nums = [...new Set(epRes.data.map(e => e.seasonNumber))].filter(n => n > 0).sort((a, b) => b - a)
        if (nums.length > 0) setExpandedSeasons({ [nums[0]]: true })
      }
    } catch (e) {
      setEpError(e.response?.data?.detail || 'Laden fehlgeschlagen')
    }
    setEpLoading(false)

    clearInterval(queueInterval.current)
    queueInterval.current = setInterval(() => {
      api.get(`/sonarr/servers/${serverId}/queue`)
        .then(r => {
          const allQ = r.data?.records || []
          setQueue(allQ.filter(r => r.seriesId === sonarrId || r.series?.id === sonarrId))
        })
        .catch(() => {})
    }, 5000)
  }

  useEffect(() => () => clearInterval(queueInterval.current), [])

  const triggerSearch = async (serverId, sonarrId) => {
    setSearching(p => ({ ...p, [serverId]: true }))
    try { await api.post(`/sonarr/servers/${serverId}/series/${sonarrId}/search`) } catch {}
    setTimeout(() => setSearching(p => ({ ...p, [serverId]: false })), 3000)
  }

  const toggleMonitor = async (serverId, ids, monitored) => {
    try {
      await api.put(`/sonarr/servers/${serverId}/episodes/monitor`, { episodeIds: ids, monitored })
      setEpisodes(prev => prev.map(ep => ids.includes(ep.id) ? { ...ep, monitored } : ep))
    } catch {}
  }

  const deleteFile = async (serverId, sonarrId, fileId) => {
    try {
      await api.delete(`/sonarr/servers/${serverId}/episodefile/${fileId}`)
      const r = await api.get(`/sonarr/servers/${serverId}/series/${sonarrId}/episodes`)
      setEpisodes(r.data)
    } catch {}
  }

  const removeFromQueue = async (serverId, queueId) => {
    try {
      await api.delete(`/sonarr/servers/${serverId}/queue/${queueId}`)
      setQueue(prev => prev.filter(q => q.id !== queueId))
    } catch {}
  }

  const [rootFolders, setRootFolders] = useState([])
  const [allTags, setAllTags] = useState([])

  const openEdit = async (serverId, srv) => {
    setShowEdit(true)
    setShowDelete(false)
    setEditForm({ monitored: srv.monitored, qualityProfileId: null, seriesType: 'standard', seasonFolder: true, path: '', tags: [] })
    try {
      const [pRes, sRes, fRes, tRes] = await Promise.all([
        api.get(`/sonarr/servers/${serverId}/profiles`),
        api.get(`/sonarr/servers/${serverId}/series/${srv.sonarr_id}`),
        api.get(`/sonarr/servers/${serverId}/rootfolders`),
        api.get(`/sonarr/servers/${serverId}/tags`).catch(() => ({ data: [] })),
      ])
      setProfiles(pRes.data)
      setRootFolders(fRes.data)
      setAllTags(tRes.data)
      setEditForm({
        monitored: sRes.data.monitored,
        qualityProfileId: sRes.data.qualityProfileId,
        seriesType: sRes.data.seriesType || 'standard',
        seasonFolder: sRes.data.seasonFolder ?? true,
        path: sRes.data.path || '',
        tags: sRes.data.tags || [],
      })
    } catch {}
  }

  const saveEdit = async (serverId, sonarrId) => {
    setSaving(true)
    try {
      await api.put(`/sonarr/servers/${serverId}/series/${sonarrId}`, editForm)
      setShowEdit(false)
      loadStatus()
    } catch {}
    setSaving(false)
  }

  const doDelete = async (serverId, sonarrId) => {
    setDeleting(true)
    try {
      await api.delete(`/sonarr/servers/${serverId}/series/${sonarrId}`, { params: { delete_files: deleteFiles } })
      setShowDelete(false)
      setExpanded(null)
      clearInterval(queueInterval.current)
      loadStatus()
    } catch {}
    setDeleting(false)
  }

  // ─── Add form helpers ──────────────────────────────────────────
  const openAddForm = async () => {
    setShowAdd(true)
    setAddError(null)
    try {
      const res = await api.get('/sonarr/servers')
      setServers(res.data)
      if (res.data.length === 1) selectServer(res.data[0].id)
    } catch {}
  }

  const selectServer = async (serverId) => {
    setAddForm(p => ({ ...p, server_id: serverId, rootFolders: [], profiles: [], root_folder_path: '', quality_profile_id: null }))
    try {
      const [folders, profs] = await Promise.all([
        api.get(`/sonarr/servers/${serverId}/rootfolders`),
        api.get(`/sonarr/servers/${serverId}/profiles`),
      ])
      setAddForm(p => ({
        ...p, rootFolders: folders.data, profiles: profs.data,
        root_folder_path: folders.data[0]?.path || '',
        quality_profile_id: profs.data[0]?.id || null,
      }))
    } catch { setAddError('Server-Daten konnten nicht geladen werden') }
  }

  const submitAdd = async () => {
    if (!addForm.server_id || !addForm.root_folder_path || !addForm.quality_profile_id) return
    setAddLoading(true)
    setAddError(null)
    try {
      await api.post(`/sonarr/servers/${addForm.server_id}/add`, {
        tmdb_id: tmdbId, title,
        root_folder_path: addForm.root_folder_path,
        quality_profile_id: addForm.quality_profile_id,
        monitor_strategy: addForm.monitor_strategy,
      })
      setShowAdd(false)
      loadStatus()
    } catch (e) { setAddError(e.response?.data?.detail || 'Hinzufügen fehlgeschlagen') }
    setAddLoading(false)
  }

  // ─── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-white/40">Sonarr...</span>
      </div>
    )
  }

  if (!status) return null

  // ─── Series FOUND ──────────────────────────────────────────────
  if (status.found && status.servers?.length > 0) {
    return (
      <div className="space-y-2">
        {status.servers.map(srv => {
          const isExpanded = expanded === srv.server_id

          // Group episodes by season
          const seasons = {}
          episodes.forEach(ep => {
            if (!seasons[ep.seasonNumber]) seasons[ep.seasonNumber] = []
            seasons[ep.seasonNumber].push(ep)
          })
          const seasonNums = Object.keys(seasons).map(Number).sort((a, b) => b - a)

          const eventLabels = {
            grabbed: 'Grabbed', downloadFolderImported: 'Importiert',
            episodeFileDeleted: 'Gelöscht', downloadFailed: 'Fehler',
          }

          return (
            <div key={srv.server_id} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              {/* ── Header ── */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-sm font-medium text-blue-300">{srv.server_name}</span>
                </div>
                <button
                  onClick={() => expand(srv.server_id, srv.sonarr_id)}
                  className="p-2 rounded-lg text-white/40 active:bg-white/[0.08]"
                >
                  {isExpanded ? <HiChevronUp className="w-4 h-4" /> : <HiChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* ── Progress bar ── */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/50 shrink-0">{srv.episodes_on_disk}/{srv.total_episodes} Ep.</span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" style={{ width: `${srv.percent_complete}%` }} />
                </div>
                <span className="text-xs text-blue-400 font-medium shrink-0">{srv.percent_complete}%</span>
                <span className="text-xs text-white/30 shrink-0">{srv.size_gb} GB</span>
              </div>

              {/* ══ Expanded ══ */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-3">

                  {/* ── Actions ── */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => triggerSearch(srv.server_id, srv.sonarr_id)}
                      disabled={searching[srv.server_id]}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-blue-500/20 text-blue-400 active:bg-blue-500/30 disabled:opacity-50"
                    >
                      {searching[srv.server_id] ? <HiArrowPath className="w-4 h-4 animate-spin" /> : <HiMagnifyingGlass className="w-4 h-4" />}
                      Alles suchen
                    </button>
                    <button
                      onClick={() => api.post(`/sonarr/servers/${srv.server_id}/command`, { name: 'RescanSeries', seriesId: srv.sonarr_id })}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50 active:bg-white/[0.1]"
                    >
                      <HiArrowPath className="w-4 h-4" /> Rescan
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

                  {/* ── Edit form ── */}
                  {showEdit && editForm && (
                    <div className="p-3 bg-white/[0.04] border border-white/[0.08] rounded-xl space-y-3">
                      <p className="text-xs font-medium text-white/50">Serie bearbeiten</p>

                      {/* Monitored */}
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input type="checkbox" checked={editForm.monitored} onChange={e => setEditForm(p => ({ ...p, monitored: e.target.checked }))} className="rounded border-white/20 bg-white/[0.06] w-4 h-4" />
                        <span className="text-sm text-white/70">Monitored</span>
                      </label>

                      {/* Quality Profile + Type */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-white/40 block mb-1">Quality Profile</label>
                          <select value={editForm.qualityProfileId || ''} onChange={e => setEditForm(p => ({ ...p, qualityProfileId: Number(e.target.value) }))} className="glass-input py-2 text-sm w-full">
                            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-white/40 block mb-1">Typ</label>
                          <select value={editForm.seriesType} onChange={e => setEditForm(p => ({ ...p, seriesType: e.target.value }))} className="glass-input py-2 text-sm w-full">
                            <option value="standard">Standard</option>
                            <option value="anime">Anime</option>
                            <option value="daily">Daily</option>
                          </select>
                        </div>
                      </div>

                      {/* Path / Storage */}
                      <div>
                        <label className="text-xs text-white/40 block mb-1">Speicherort</label>
                        <input
                          value={editForm.path}
                          onChange={e => setEditForm(p => ({ ...p, path: e.target.value }))}
                          className="glass-input py-2 text-sm w-full"
                        />
                        {rootFolders.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {rootFolders.map(f => (
                              <button
                                key={f.path}
                                onClick={() => {
                                  // Replace root folder portion of the path
                                  const seriesFolder = editForm.path.split('/').pop()
                                  setEditForm(p => ({ ...p, path: `${f.path}/${seriesFolder}` }))
                                }}
                                className={`text-[11px] px-2 py-1 rounded-lg ${
                                  editForm.path.startsWith(f.path)
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/[0.06] text-white/40 active:bg-white/[0.1]'
                                }`}
                              >
                                {f.path} ({f.free_space_gb} GB frei)
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Season Folder */}
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input type="checkbox" checked={editForm.seasonFolder} onChange={e => setEditForm(p => ({ ...p, seasonFolder: e.target.checked }))} className="rounded border-white/20 bg-white/[0.06] w-4 h-4" />
                        <span className="text-sm text-white/70">Season Folder</span>
                      </label>

                      {/* Tags */}
                      {allTags.length > 0 && (
                        <div>
                          <label className="text-xs text-white/40 block mb-1">Tags</label>
                          <div className="flex flex-wrap gap-1.5">
                            {allTags.map(tag => {
                              const selected = editForm.tags.includes(tag.id)
                              return (
                                <button
                                  key={tag.id}
                                  onClick={() => setEditForm(p => ({
                                    ...p,
                                    tags: selected ? p.tags.filter(t => t !== tag.id) : [...p.tags, tag.id],
                                  }))}
                                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                                    selected
                                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                      : 'bg-white/[0.06] text-white/40 active:bg-white/[0.1]'
                                  }`}
                                >
                                  {tag.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setShowEdit(false)} className="flex-1 px-3 py-2 rounded-xl text-sm bg-white/[0.06] text-white/50 active:bg-white/[0.1]">Abbrechen</button>
                        <button onClick={() => saveEdit(srv.server_id, srv.sonarr_id)} disabled={saving} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-blue-500/20 text-blue-400 active:bg-blue-500/30 disabled:opacity-30">
                          {saving ? 'Speichere...' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Delete confirm ── */}
                  {showDelete && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                      <p className="text-sm text-red-400 font-medium">"{title}" aus Sonarr entfernen?</p>
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input type="checkbox" checked={deleteFiles} onChange={e => setDeleteFiles(e.target.checked)} className="rounded border-red-500/30 bg-red-500/10 w-4 h-4" />
                        <span className="text-sm text-red-400/80">Dateien auch löschen ({srv.size_gb} GB)</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setShowDelete(false)} className="flex-1 px-3 py-2 rounded-xl text-xs bg-white/[0.06] text-white/50">Nein</button>
                        <button onClick={() => doDelete(srv.server_id, srv.sonarr_id)} disabled={deleting} className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 disabled:opacity-30">
                          {deleting ? 'Lösche...' : 'Ja, löschen'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Active downloads ── */}
                  {queue.length > 0 && (
                    <div>
                      <p className="text-xs text-white/40 font-medium mb-1.5">Downloads ({queue.length})</p>
                      <div className="space-y-1.5">
                        {queue.map(item => {
                          const progress = item.sizeleft && item.size ? Math.round((1 - item.sizeleft / item.size) * 100) : 0
                          return (
                            <div key={item.id} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white/70 truncate">{item.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">{item.quality?.quality?.name || '?'}</span>
                                    <span className="text-xs text-white/40">{formatSize(item.size)}</span>
                                    {item.timeleft && <span className="text-xs text-white/30">ETA: {item.timeleft}</span>}
                                  </div>
                                </div>
                                <button onClick={() => removeFromQueue(srv.server_id, item.id)} className="p-2 text-white/30 active:text-red-400 shrink-0">
                                  <HiXMark className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xs text-white/40 w-10 text-right">{progress}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Loading episodes ── */}
                  {epLoading && (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {epError && <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-xl">{epError}</p>}

                  {/* ── Seasons accordion ── */}
                  {!epLoading && seasonNums.length > 0 && (
                    <div className="space-y-1.5">
                      {seasonNums.map(num => {
                        const eps = seasons[num].sort((a, b) => a.episodeNumber - b.episodeNumber)
                        const fileCount = eps.filter(e => e.hasFile).length
                        const isSznExpanded = expandedSeasons[num]
                        const label = num === 0 ? 'Specials' : `Staffel ${num}`

                        return (
                          <div key={num} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                            {/* Season header */}
                            <div className="flex items-center">
                              <button
                                onClick={() => setExpandedSeasons(p => ({ ...p, [num]: !p[num] }))}
                                className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5 active:bg-white/[0.04]"
                              >
                                {isSznExpanded ? <HiChevronUp className="w-4 h-4 text-white/30 shrink-0" /> : <HiChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
                                <span className="text-sm font-medium text-white/70">{label}</span>
                                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden mx-2">
                                  <div
                                    className={`h-full rounded-full ${fileCount >= eps.length ? 'bg-green-400' : 'bg-blue-400/60'}`}
                                    style={{ width: `${eps.length > 0 ? (fileCount / eps.length * 100) : 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-white/40 shrink-0">{fileCount}/{eps.length}</span>
                              </button>
                              {/* Season monitor all toggle */}
                              <button
                                onClick={() => {
                                  const allMonitored = eps.every(e => e.monitored)
                                  toggleMonitor(srv.server_id, eps.map(e => e.id), !allMonitored)
                                }}
                                className={`p-2 shrink-0 ${eps.every(e => e.monitored) ? 'text-blue-400' : 'text-white/20'}`}
                                title={eps.every(e => e.monitored) ? 'Ganze Staffel unmonitoren' : 'Ganze Staffel monitoren'}
                              >
                                {eps.every(e => e.monitored) ? <HiEye className="w-4 h-4" /> : <HiEyeSlash className="w-4 h-4" />}
                              </button>
                              {/* Season search button */}
                              <button
                                onClick={() => setReleaseSearch(
                                  releaseSearch?.seasonNumber === num && releaseSearch?.seriesId
                                    ? null
                                    : { seriesId: srv.sonarr_id, seasonNumber: num, title: `${title} ${label}` }
                                )}
                                className="p-2 text-white/30 active:text-blue-400 shrink-0"
                                title="Staffel durchsuchen"
                              >
                                <HiMagnifyingGlass className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Season release search */}
                            {releaseSearch?.seasonNumber === num && releaseSearch?.seriesId && (
                              <div className="px-2 pb-2">
                                <ReleaseSearchPanel
                                  serverId={srv.server_id}
                                  seriesId={releaseSearch.seriesId}
                                  seasonNumber={releaseSearch.seasonNumber}
                                  title={releaseSearch.title}
                                  onClose={() => setReleaseSearch(null)}
                                />
                              </div>
                            )}

                            {/* Episodes */}
                            {isSznExpanded && (
                              <div className="border-t border-white/[0.06]">
                                {eps.map(ep => {
                                  const airDate = ep.airDateUtc ? new Date(ep.airDateUtc) : null
                                  const isFuture = airDate && airDate > new Date()
                                  const isPast = airDate && airDate < new Date()
                                  const dateStr = airDate ? airDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null

                                  return (
                                  <div key={ep.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.04] last:border-0 active:bg-white/[0.03]">
                                    {/* Number */}
                                    <span className="w-6 text-xs text-white/40 text-right shrink-0 font-medium">
                                      {ep.episodeNumber}
                                    </span>

                                    {/* Monitor toggle */}
                                    <button
                                      onClick={() => toggleMonitor(srv.server_id, [ep.id], !ep.monitored)}
                                      className={`p-1 shrink-0 ${ep.monitored ? 'text-blue-400' : 'text-white/20'}`}
                                    >
                                      {ep.monitored ? <HiEye className="w-4 h-4" /> : <HiEyeSlash className="w-4 h-4" />}
                                    </button>

                                    {/* Title + info */}
                                    <div className="flex-1 min-w-0">
                                      <span className="text-xs text-white/70 truncate block">{ep.title || 'TBA'}</span>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                        {/* Air date */}
                                        {dateStr && (
                                          <span className={`text-[10px] ${isFuture ? 'text-blue-400/60' : 'text-white/25'}`}>
                                            {dateStr}
                                          </span>
                                        )}
                                        {/* File info */}
                                        {ep.hasFile && ep.file ? (
                                          <>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">{ep.file.quality}</span>
                                            <span className="text-[10px] text-white/25">{formatSize(ep.file.size)}</span>
                                          </>
                                        ) : (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                            isFuture ? 'bg-blue-500/10 text-blue-400/70' :
                                            ep.monitored && isPast ? 'bg-red-500/10 text-red-400' :
                                            'text-white/20'
                                          }`}>
                                            {isFuture ? 'Kommend' : ep.monitored && isPast ? 'Fehlt' : '-'}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Delete file */}
                                    {ep.hasFile && ep.file && (
                                      <button
                                        onClick={() => deleteFile(srv.server_id, srv.sonarr_id, ep.file.id)}
                                        className="p-1.5 text-white/20 active:text-red-400 shrink-0"
                                        title="Datei löschen"
                                      >
                                        <HiTrash className="w-4 h-4" />
                                      </button>
                                    )}

                                    {/* Episode search */}
                                    <button
                                      onClick={() => setReleaseSearch(
                                        releaseSearch?.episodeId === ep.id
                                          ? null
                                          : { episodeId: ep.id, title: `S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')} ${ep.title || ''}` }
                                      )}
                                      className={`p-1.5 rounded-lg shrink-0 ${
                                        releaseSearch?.episodeId === ep.id
                                          ? 'text-blue-400 bg-blue-500/15'
                                          : 'text-white/25 active:text-blue-400'
                                      }`}
                                      title="Episode suchen"
                                    >
                                      <HiMagnifyingGlass className="w-4 h-4" />
                                    </button>
                                  </div>
                                  )
                                })}

                                {/* Episode release search (below the episode list) */}
                                {releaseSearch?.episodeId && eps.some(e => e.id === releaseSearch.episodeId) && (
                                  <div className="p-2">
                                    <ReleaseSearchPanel
                                      serverId={srv.server_id}
                                      episodeId={releaseSearch.episodeId}
                                      title={releaseSearch.title}
                                      onClose={() => setReleaseSearch(null)}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* ── History (collapsible) ── */}
                  {history.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 text-xs text-white/40 active:text-white/60 py-1"
                      >
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
                                item.eventType === 'downloadFailed' || item.eventType === 'episodeFileDeleted' ? 'bg-red-400' :
                                'bg-white/20'
                              }`} />
                              <span className="text-xs text-white/50 shrink-0 w-16">{eventLabels[item.eventType] || item.eventType}</span>
                              <span className="text-xs text-white/40 truncate flex-1">
                                {item.episode ? `S${String(item.episode.seasonNumber).padStart(2,'0')}E${String(item.episode.episodeNumber).padStart(2,'0')}` : ''}
                                {item.episode?.title ? ` ${item.episode.title}` : ''}
                              </span>
                              <span className="text-xs text-white/25 shrink-0">{formatDate(item.date)}</span>
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

  // ─── Series NOT FOUND — Add flow ───────────────────────────────
  return <AddSeriesFlow
    tmdbId={tmdbId}
    title={title}
    showAdd={showAdd}
    setShowAdd={setShowAdd}
    addForm={addForm}
    setAddForm={setAddForm}
    addLoading={addLoading}
    setAddLoading={setAddLoading}
    addError={addError}
    setAddError={setAddError}
    servers={servers}
    setServers={setServers}
    openAddForm={openAddForm}
    selectServer={selectServer}
    submitAdd={submitAdd}
    loadStatus={loadStatus}
  />
}
