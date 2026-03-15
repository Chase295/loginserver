import { useEffect, useState } from 'react'
import { HiCheck, HiXMark, HiChevronDown, HiChevronUp, HiPlay, HiFilm } from 'react-icons/hi2'
import api from '../api/client'

function formatSize(bytes) {
  if (!bytes) return '-'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

function formatDate(ts) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function PlexStatus({ tmdbId, mediaType }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!tmdbId) return
    setLoading(true)
    api.get(`/plex/status/${tmdbId}`, { params: { media_type: mediaType } })
      .then(r => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [tmdbId, mediaType])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-white/40">Plex...</span>
      </div>
    )
  }

  if (!status) return null

  // Not on any Plex server
  if (!status.found || !status.servers?.length) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <HiXMark className="w-4 h-4 text-white/20" />
        <span className="text-xs text-white/30">Nicht auf Plex</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {status.servers.map(srv => {
        const isExpanded = expanded === srv.server_id
        const resolution = srv.videoResolution
          ? `${srv.videoResolution}${srv.videoResolution.match(/\d/) ? 'p' : ''}`
          : null

        return (
          <div key={srv.server_id} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-sm font-medium text-amber-300">{srv.server_name}</span>
              </div>
              <button onClick={() => setExpanded(isExpanded ? null : srv.server_id)} className="p-2 rounded-lg text-white/40 active:bg-white/[0.08]">
                {isExpanded ? <HiChevronUp className="w-4 h-4" /> : <HiChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Status line */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium flex items-center gap-1">
                <HiCheck className="w-3 h-3" /> Auf Plex
              </span>
              {resolution && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  resolution.includes('4k') || resolution.includes('2160') ? 'bg-purple-500/20 text-purple-300' :
                  resolution.includes('1080') ? 'bg-blue-500/20 text-blue-300' :
                  'bg-white/[0.08] text-white/50'
                }`}>{resolution}</span>
              )}
              {srv.viewCount > 0 && (
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <HiPlay className="w-3 h-3" /> {srv.viewCount}x geschaut
                </span>
              )}
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-2">
                {/* File info */}
                <div className="grid grid-cols-2 gap-2">
                  {srv.videoCodec && (
                    <div className="bg-white/[0.04] rounded-lg p-2">
                      <p className="text-[10px] text-white/30">Video</p>
                      <p className="text-xs text-white/60">{srv.videoCodec.toUpperCase()} {resolution}</p>
                    </div>
                  )}
                  {srv.audioCodec && (
                    <div className="bg-white/[0.04] rounded-lg p-2">
                      <p className="text-[10px] text-white/30">Audio</p>
                      <p className="text-xs text-white/60">{srv.audioCodec.toUpperCase()} {srv.audioChannels ? `${srv.audioChannels}ch` : ''}</p>
                    </div>
                  )}
                  {srv.fileSize && (
                    <div className="bg-white/[0.04] rounded-lg p-2">
                      <p className="text-[10px] text-white/30">Größe</p>
                      <p className="text-xs text-white/60">{formatSize(srv.fileSize)}</p>
                    </div>
                  )}
                  {srv.lastViewedAt && (
                    <div className="bg-white/[0.04] rounded-lg p-2">
                      <p className="text-[10px] text-white/30">Zuletzt geschaut</p>
                      <p className="text-xs text-white/60">{formatDate(srv.lastViewedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
