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

// Language code → human-readable name + flag emoji
const LANG_INFO = {
  de: { name: 'Deutsch', flag: '🇩🇪' },
  en: { name: 'English', flag: '🇺🇸' },
  ja: { name: 'Japanisch', flag: '🇯🇵' },
  fr: { name: 'Français', flag: '🇫🇷' },
  es: { name: 'Español', flag: '🇪🇸' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  ko: { name: 'Koreanisch', flag: '🇰🇷' },
  zh: { name: 'Chinesisch', flag: '🇨🇳' },
  pt: { name: 'Português', flag: '🇵🇹' },
  ru: { name: 'Russisch', flag: '🇷🇺' },
  pl: { name: 'Polnisch', flag: '🇵🇱' },
  nl: { name: 'Niederländisch', flag: '🇳🇱' },
  sv: { name: 'Schwedisch', flag: '🇸🇪' },
  no: { name: 'Norwegisch', flag: '🇳🇴' },
  da: { name: 'Dänisch', flag: '🇩🇰' },
  fi: { name: 'Finnisch', flag: '🇫🇮' },
  tr: { name: 'Türkisch', flag: '🇹🇷' },
  ar: { name: 'Arabisch', flag: '🇸🇦' },
  hi: { name: 'Hindi', flag: '🇮🇳' },
  he: { name: 'Hebräisch', flag: '🇮🇱' },
  cs: { name: 'Tschechisch', flag: '🇨🇿' },
  hu: { name: 'Ungarisch', flag: '🇭🇺' },
  ro: { name: 'Rumänisch', flag: '🇷🇴' },
  uk: { name: 'Ukrainisch', flag: '🇺🇦' },
  th: { name: 'Thailändisch', flag: '🇹🇭' },
  id: { name: 'Indonesisch', flag: '🇮🇩' },
  vi: { name: 'Vietnamesisch', flag: '🇻🇳' },
  el: { name: 'Griechisch', flag: '🇬🇷' },
  sk: { name: 'Slowakisch', flag: '🇸🇰' },
  hr: { name: 'Kroatisch', flag: '🇭🇷' },
  bg: { name: 'Bulgarisch', flag: '🇧🇬' },
  sr: { name: 'Serbisch', flag: '🇷🇸' },
  ca: { name: 'Katalanisch', flag: '🏴' },
  lt: { name: 'Litauisch', flag: '🇱🇹' },
  lv: { name: 'Lettisch', flag: '🇱🇻' },
  et: { name: 'Estnisch', flag: '🇪🇪' },
  sl: { name: 'Slowenisch', flag: '🇸🇮' },
  mk: { name: 'Mazedonisch', flag: '🇲🇰' },
  ms: { name: 'Malaiisch', flag: '🇲🇾' },
  fa: { name: 'Persisch', flag: '🇮🇷' },
  ur: { name: 'Urdu', flag: '🇵🇰' },
  bn: { name: 'Bengalisch', flag: '🇧🇩' },
  ta: { name: 'Tamilisch', flag: '🇱🇰' },
  te: { name: 'Telugu', flag: '🇮🇳' },
  ml: { name: 'Malayalisch', flag: '🇮🇳' },
  kn: { name: 'Kannada', flag: '🇮🇳' },
  mr: { name: 'Marathi', flag: '🇮🇳' },
  pa: { name: 'Punjabi', flag: '🇮🇳' },
  gu: { name: 'Gujarati', flag: '🇮🇳' },
  sw: { name: 'Swahili', flag: '🇹🇿' },
  af: { name: 'Afrikaans', flag: '🇿🇦' },
  zu: { name: 'Zulu', flag: '🇿🇦' },
  is: { name: 'Isländisch', flag: '🇮🇸' },
  ga: { name: 'Irisch', flag: '🇮🇪' },
  cy: { name: 'Walisisch', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  eu: { name: 'Baskisch', flag: '🏴' },
  gl: { name: 'Galicisch', flag: '🏴' },
  la: { name: 'Latein', flag: '🏛️' },
  xx: { name: 'Keine Sprache', flag: '🌐' },
}

function getLangDisplay(code) {
  if (!code) return null
  const lc = code.toLowerCase().split('-')[0]
  const info = LANG_INFO[lc]
  if (info) return { flag: info.flag, name: info.name, code: lc }
  return { flag: '🌐', name: code.toUpperCase(), code: lc }
}

function formatSize(bytes) {
  if (!bytes) return null
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`
}

function LangPills({ languages, color = 'green' }) {
  if (!languages?.length) return null
  const colorMap = {
    green: 'bg-green-500/15 text-green-300 border-green-500/20',
    blue: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  }
  return (
    <div className="flex flex-wrap gap-1">
      {languages.map((lang, i) => {
        const display = getLangDisplay(lang)
        if (!display) return null
        return (
          <span
            key={i}
            title={display.name}
            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-0.5 ${colorMap[color]}`}
          >
            <span>{display.flag}</span>
            <span>{display.code.toUpperCase()}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function WatchProviders({ mediaType, tmdbId }) {
  const [data, setData] = useState(null)
  const [plexServers, setPlexServers] = useState([])
  const [jellyfinServers, setJellyfinServers] = useState([])
  const [tmdbLanguages, setTmdbLanguages] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedPlex, setExpandedPlex] = useState(null)

  useEffect(() => {
    if (!tmdbId || !mediaType) return
    setLoading(true)
    setPlexServers([])
    setJellyfinServers([])
    setTmdbLanguages([])

    Promise.all([
      api.get(`/media/${mediaType}/${tmdbId}/providers`).then(r => setData(r.data)).catch(() => setData(null)),
      api.get(`/plex/status/${tmdbId}`, { params: { media_type: mediaType } })
        .then(r => setPlexServers(r.data?.servers || []))
        .catch(() => setPlexServers([])),
      api.get(`/jellyfin/status/${tmdbId}`, { params: { media_type: mediaType } })
        .then(r => setJellyfinServers(r.data?.servers || []))
        .catch(() => setJellyfinServers([])),
      api.get(`/media/${mediaType}/${tmdbId}/languages`)
        .then(r => setTmdbLanguages(r.data?.languages || []))
        .catch(() => setTmdbLanguages([])),
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

  if (!hasAny && !tmdbLanguages.length) {
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
                    <div className="px-2.5 pb-2 space-y-1.5">
                      {/* Season overview (TV only) */}
                      {srv.seasons?.length > 0 && (
                        <div className="space-y-1">
                          {srv.seasons.map(s => {
                            const pct = s.episodes > 0 ? Math.round(s.viewedEpisodes / s.episodes * 100) : 0
                            return (
                              <div key={s.number} className="flex items-center gap-2">
                                <span className="text-[10px] text-white/35 w-7 shrink-0">S{String(s.number).padStart(2,'0')}</span>
                                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-400' : pct > 0 ? 'bg-blue-400' : 'bg-white/[0.08]'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                                </div>
                                <span className={`text-[9px] w-12 text-right shrink-0 ${pct >= 100 ? 'text-green-400' : pct > 0 ? 'text-blue-400/70' : 'text-white/20'}`}>
                                  {s.viewedEpisodes}/{s.episodes}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {/* File info grid */}
                      <div className="grid grid-cols-2 gap-1.5">
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
                      {/* Audio / Subtitle language pills */}
                      {(srv.audioLanguages?.length > 0 || srv.subtitleLanguages?.length > 0) && (
                        <div className="space-y-1 pt-0.5">
                          {srv.audioLanguages?.length > 0 && (
                            <div>
                              <p className="text-[9px] text-white/25 mb-0.5">Audio</p>
                              <LangPills languages={srv.audioLanguages} color="green" />
                            </div>
                          )}
                          {srv.subtitleLanguages?.length > 0 && (
                            <div>
                              <p className="text-[9px] text-white/25 mb-0.5">Untertitel</p>
                              <LangPills languages={srv.subtitleLanguages} color="blue" />
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
        </div>
      )}

      {/* Jellyfin servers */}
      {jellyfinServers.length > 0 && (
        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5">Jellyfin</p>
          <div className="space-y-1.5">
            {jellyfinServers.map((srv, i) => (
              <div key={i} className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-purple-500/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-purple-300">JF</span>
                  </div>
                  <span className="text-xs text-purple-300 font-medium flex-1">{srv.server_name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium flex items-center gap-0.5">
                    <HiCheck className="w-3 h-3" /> Vorhanden
                  </span>
                  {srv.played && <span className="text-[10px] text-white/40">Gesehen</span>}
                </div>
                {/* Jellyfin audio/subtitle languages */}
                {(srv.audioLanguages?.length > 0 || srv.subtitleLanguages?.length > 0) && (
                  <div className="space-y-1 mt-1.5 pt-1.5 border-t border-purple-500/10">
                    {srv.audioLanguages?.length > 0 && (
                      <div>
                        <p className="text-[9px] text-white/25 mb-0.5">Audio</p>
                        <LangPills languages={srv.audioLanguages} color="green" />
                      </div>
                    )}
                    {srv.subtitleLanguages?.length > 0 && (
                      <div>
                        <p className="text-[9px] text-white/25 mb-0.5">Untertitel</p>
                        <LangPills languages={srv.subtitleLanguages} color="blue" />
                      </div>
                    )}
                  </div>
                )}
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

      {/* TMDB available languages */}
      {tmdbLanguages.length > 0 && (
        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5">Verfügbare Sprachen</p>
          <div className="flex flex-wrap gap-1">
            {tmdbLanguages.slice(0, 8).map((code, i) => {
              const display = getLangDisplay(code)
              if (!display) return null
              return (
                <span
                  key={i}
                  title={display.name}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 border border-white/[0.08] flex items-center gap-1"
                >
                  <span>{display.flag}</span>
                  <span>{display.code.toUpperCase()}</span>
                </span>
              )
            })}
            {tmdbLanguages.length > 8 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 border border-white/[0.06]">
                +{tmdbLanguages.length - 8}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
