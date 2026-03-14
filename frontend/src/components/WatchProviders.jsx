import { useEffect, useState } from 'react'
import api from '../api/client'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const SECTION_LABELS = {
  flatrate: 'Streaming',
  rent: 'Leihen',
  buy: 'Kaufen',
}

export default function WatchProviders({ mediaType, tmdbId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tmdbId || !mediaType) return
    setLoading(true)
    api.get(`/media/${mediaType}/${tmdbId}/providers`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [tmdbId, mediaType])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-white/30">Lade Streaming-Infos...</span>
      </div>
    )
  }

  if (!data || (!data.flatrate && !data.rent && !data.buy)) {
    return (
      <p className="text-xs text-white/20 py-1">Keine Streaming-Infos verfügbar</p>
    )
  }

  return (
    <div className="space-y-3">
      {['flatrate', 'rent', 'buy'].map(section => {
        const providers = data[section]
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
