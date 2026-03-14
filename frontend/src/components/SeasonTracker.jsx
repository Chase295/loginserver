import { useEffect, useState } from 'react'
import { HiChevronDown, HiCheck, HiMinus } from 'react-icons/hi2'
import api from '../api/client'

export default function SeasonTracker({ tmdbId, progress, onChange, readonly }) {
  const [seasons, setSeasons] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [episodeData, setEpisodeData] = useState({})
  const [loading, setLoading] = useState(true)

  // progress = { "1": [1,2,3], "2": [1,2] } — season_number -> watched episode numbers

  useEffect(() => {
    if (!tmdbId) return
    api.get(`/media/tv/${tmdbId}`).then(res => {
      // Filter out specials (season 0) optionally keep them
      const s = (res.data.seasons || []).filter(s => s.season_number > 0)
      setSeasons(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [tmdbId])

  const loadEpisodes = async (seasonNum) => {
    if (episodeData[seasonNum]) return
    try {
      const res = await api.get(`/media/tv/${tmdbId}/season/${seasonNum}`)
      setEpisodeData(prev => ({ ...prev, [seasonNum]: res.data.episodes || [] }))
    } catch {}
  }

  const toggleExpand = (seasonNum) => {
    if (expanded === seasonNum) {
      setExpanded(null)
    } else {
      setExpanded(seasonNum)
      loadEpisodes(seasonNum)
    }
  }

  const getWatched = (seasonNum) => progress?.[String(seasonNum)] || []

  const toggleEpisode = (seasonNum, epNum) => {
    if (readonly) return
    const key = String(seasonNum)
    const current = getWatched(seasonNum)
    const newWatched = current.includes(epNum)
      ? current.filter(e => e !== epNum)
      : [...current, epNum].sort((a, b) => a - b)
    onChange({ ...progress, [key]: newWatched })
  }

  const toggleSeason = (seasonNum, totalEpisodes) => {
    if (readonly) return
    const key = String(seasonNum)
    const current = getWatched(seasonNum)
    const allEps = Array.from({ length: totalEpisodes }, (_, i) => i + 1)
    const allWatched = current.length === totalEpisodes
    onChange({ ...progress, [key]: allWatched ? [] : allEps })
  }

  const totalWatched = Object.values(progress || {}).reduce((sum, eps) => sum + eps.length, 0)
  const totalEpisodes = seasons.reduce((sum, s) => sum + (s.episode_count || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (seasons.length === 0) return null

  return (
    <div>
      {/* Overall progress */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/40 uppercase tracking-wider">Fortschritt</span>
        <span className="text-xs text-white/50">
          {totalWatched}/{totalEpisodes} Folgen
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/[0.06] rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-300"
          style={{ width: totalEpisodes > 0 ? `${(totalWatched / totalEpisodes) * 100}%` : '0%' }}
        />
      </div>

      {/* Seasons */}
      <div className="space-y-2">
        {seasons.map(season => {
          const sNum = season.season_number
          const watched = getWatched(sNum)
          const epCount = season.episode_count || 0
          const isExpanded = expanded === sNum
          const allWatched = watched.length === epCount && epCount > 0
          const someWatched = watched.length > 0 && !allWatched

          return (
            <div key={sNum} className="rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
              {/* Season header */}
              <button
                onClick={() => toggleExpand(sNum)}
                className="w-full flex items-center gap-3 p-3 active:bg-white/[0.04] transition-colors"
              >
                {/* Check button */}
                {!readonly && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSeason(sNum, epCount) }}
                    className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                      allWatched
                        ? 'bg-green-500 text-white'
                        : someWatched
                          ? 'bg-amber-500/30 text-amber-400 border border-amber-400/30'
                          : 'bg-white/[0.06] text-white/20'
                    }`}
                  >
                    {allWatched ? <HiCheck className="w-4 h-4" /> : someWatched ? <HiMinus className="w-3 h-3" /> : null}
                  </button>
                )}

                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium">Staffel {sNum}</p>
                  <p className="text-[11px] text-white/30">
                    {watched.length}/{epCount} Folgen
                  </p>
                </div>

                {/* Mini progress */}
                <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: epCount > 0 ? `${(watched.length / epCount) * 100}%` : '0%' }}
                  />
                </div>

                <HiChevronDown className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Episodes */}
              {isExpanded && (
                <div className="border-t border-white/[0.04] p-2">
                  {episodeData[sNum] ? (
                    <div className="grid grid-cols-1 gap-1">
                      {episodeData[sNum].map(ep => {
                        const isWatched = watched.includes(ep.episode_number)
                        return (
                          <button
                            key={ep.episode_number}
                            onClick={() => toggleEpisode(sNum, ep.episode_number)}
                            disabled={readonly}
                            className={`flex items-center gap-3 p-2.5 rounded-lg transition-all text-left ${
                              readonly ? '' : 'active:bg-white/[0.04]'
                            }`}
                          >
                            <div className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-xs transition-all ${
                              isWatched
                                ? 'bg-green-500 text-white'
                                : 'bg-white/[0.06] text-white/20'
                            }`}>
                              {isWatched ? <HiCheck className="w-3.5 h-3.5" /> : ep.episode_number}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${isWatched ? 'text-white/60' : 'text-white/80'}`}>
                                {ep.name || `Folge ${ep.episode_number}`}
                              </p>
                              {ep.runtime && (
                                <p className="text-[10px] text-white/25">{ep.runtime} min</p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
