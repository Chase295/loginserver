import { useEffect, useState } from 'react'
import { HiCheck, HiChevronDown, HiChevronUp, HiPlay } from 'react-icons/hi2'
import api from '../api/client'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const SECTION_LABELS = {
  plex: 'Plex',
  flatrate: 'Streaming',
  rent: 'Leihen',
  buy: 'Kaufen',
}

const PLEX_LOGO = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#EBAF00"/><text x="12" y="17" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="12" fill="#1F1F1F">P</text></svg>`)

function formatSize(bytes) {
  if (!bytes) return null
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

export default function WatchProviders({ mediaType, tmdbId }) {
  const [data, setData] = useState(null)
  const [plexServers, setPlexServers] = useState([])
  const [jellyfinServers, setJellyfinServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedPlex, setExpandedPlex] = useState(null)

  useEffect(() => {
    if (!tmdbId || !mediaType) return
    setLoading(true)
    setPlexServers([])
    setJellyfinServers([])

    Promise.all([
      api.get(`/media/${mediaType}/${tmdbId}/providers`).then(r => setData(r.data)).catch(() => setData(null)),
      api.get(`/plex/status/${tmdbId}`, { params: { media_type: mediaType } })
        .then(r => setPlexServers(r.data?.servers || []))
        .catch(() => setPlexServers([])),
      api.get(`/jellyfin/status/${tmdbId}`, { params: { media_type: mediaType } })
        .then(r => setJellyfinServers(r.data?.servers || []))
        .catch(() => setJellyfinServers([])),
    ]).finally(() => setLoading(false))
  }, [tmdbId, mediaType])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-white/30">Lade...</span>
      </div>
    )
  }

  const hasAny = plexServers.length > 0 || jellyfinServers.length > 0 || data?.flatrate || data?.rent || data?.buy

  if (!hasAny) {
    return <p className="text-xs text-white/20 py-1">Keine Streaming-Infos verfügbar</p>
  }

  return (
    <div className="space-y-3">
      {/* Plex servers */}
      {plexServers.length > 0 && (
        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5">{SECTION_LABELS.plex}</p>
          <div className="space-y-1.5">
            {plexServers.map((srv, i) => {
              const isExpanded = expandedPlex === i
              const resolution = srv.videoResolution
                ? `${srv.videoResolution}${srv.videoResolution.match(/^\d/) ? 'p' : ''}`
                : null

              return (
                <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <img src={PLEX_LOGO} alt="Plex" className="w-6 h-6 rounded shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-amber-300 font-medium">{srv.server_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium flex items-center gap-0.5">
                        <HiCheck className="w-3 h-3" /> Vorhanden
                      </span>
                      {resolution && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          resolution.includes('4k') || resolution.includes('2160') ? 'bg-purple-500/20 text-purple-300' :
                          resolution.includes('1080') ? 'bg-blue-500/20 text-blue-300' :
                          'bg-white/[0.08] text-white/50'
                        }`}>{resolution}</span>
                      )}
                      {srv.viewCount > 0 && (
                        <span className="text-[10px] text-white/40 flex items-center gap-0.5">
                          <HiPlay className="w-3 h-3" />{srv.viewCount}x
                        </span>
                      )}
                      <button onClick={() => setExpandedPlex(isExpanded ? null : i)} className="p-1 text-white/30">
                        {isExpanded ? <HiChevronUp className="w-3.5 h-3.5" /> : <HiChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-2.5 pb-2 grid grid-cols-2 gap-1.5">
                      {srv.videoCodec && (
                        <div className="bg-white/[0.04] rounded-lg p-1.5">
                          <p className="text-[9px] text-white/25">Video</p>
                          <p className="text-[11px] text-white/60">{srv.videoCodec.toUpperCase()} {resolution}</p>
                        </div>
                      )}
                      {srv.audioCodec && (
                        <div className="bg-white/[0.04] rounded-lg p-1.5">
                          <p className="text-[9px] text-white/25">Audio</p>
                          <p className="text-[11px] text-white/60">{srv.audioCodec.toUpperCase()} {srv.audioChannels ? `${srv.audioChannels}ch` : ''}</p>
                        </div>
                      )}
                      {srv.fileSize && (
                        <div className="bg-white/[0.04] rounded-lg p-1.5">
                          <p className="text-[9px] text-white/25">Größe</p>
                          <p className="text-[11px] text-white/60">{formatSize(srv.fileSize)}</p>
                        </div>
                      )}
                      {srv.lastViewedAt && (
                        <div className="bg-white/[0.04] rounded-lg p-1.5">
                          <p className="text-[9px] text-white/25">Zuletzt</p>
                          <p className="text-[11px] text-white/60">{new Date(srv.lastViewedAt * 1000).toLocaleDateString('de-DE')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Jellyfin servers */}
      {jellyfinServers.length > 0 && (
        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5">Jellyfin</p>
          <div className="space-y-1.5">
            {jellyfinServers.map((srv, i) => (
              <div key={i} className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-2.5 py-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-500/30 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-purple-300">JF</span>
                </div>
                <span className="text-xs text-purple-300 font-medium flex-1">{srv.server_name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium flex items-center gap-0.5">
                  <HiCheck className="w-3 h-3" /> Vorhanden
                </span>
                {srv.played && <span className="text-[10px] text-white/40">Gesehen</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TMDB providers */}
      {['flatrate', 'rent', 'buy'].map(section => {
        const providers = data?.[section]
        if (!providers?.length) return null
        return (
          <div key={section}>
            <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5">
              {SECTION_LABELS[section]}
            </p>
            <div className="flex flex-wrap gap-2">
              {providers.map(p => (
                <div
                  key={p.provider_id}
                  className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5"
                  title={p.provider_name}
                >
                  <img
                    src={`${TMDB_IMG}/w45${p.logo_path}`}
                    alt={p.provider_name}
                    className="w-6 h-6 rounded"
                  />
                  <span className="text-xs text-white/70">{p.provider_name}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
