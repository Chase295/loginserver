import { useEffect, useState } from 'react'
import { HiStar, HiTrash, HiLockClosed, HiLockOpen, HiPlus, HiXMark } from 'react-icons/hi2'
import Modal from './Modal'
import SeasonTracker from './SeasonTracker'
import WatchProviders from './WatchProviders'
import SonarrStatus from './SonarrStatus'
import RadarrStatus from './RadarrStatus'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const STATUS_OPTIONS = [
  { value: 'watchlist', label: 'Watchlist', color: 'from-blue-500 to-cyan-400' },
  { value: 'watching', label: 'Schaue ich', color: 'from-purple-500 to-violet-400' },
  { value: 'watched', label: 'Gesehen', color: 'from-green-500 to-emerald-400' },
  { value: 'planned', label: 'Geplant', color: 'from-amber-500 to-yellow-400' },
  { value: 'dropped', label: 'Abgebr.', color: 'from-red-500 to-rose-400' },
]

const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']

export default function MovieDetailModal({ movie, open, onClose, onUpdate, onDelete, readonly }) {
  const { user } = useAuth()
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [showNotes, setShowNotes] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  if (!movie) return null

  const backdrop = movie.backdrop_path ? `${TMDB_IMG}/w780${movie.backdrop_path}` : null
  const poster = movie.poster_url ? `${TMDB_IMG}/w342${movie.poster_url}` : null

  const save = (data) => {
    if (onUpdate) onUpdate(movie.id, data)
  }

  const setStatus = (status) => save({ status })
  const setRating = (r) => save({ rating: movie.rating === r ? null : r })
  const togglePrivate = () => save({ is_private: !movie.is_private })

  const saveNotes = () => {
    save({ notes: noteDraft })
    setShowNotes(false)
  }

  const addTag = () => {
    if (!newTag.trim()) return
    const tag = { label: newTag.trim(), color: newTagColor, is_private: false }
    save({ tags: [...(movie.tags || []), tag] })
    setNewTag('')
  }

  const removeTag = (index) => {
    save({ tags: (movie.tags || []).filter((_, i) => i !== index) })
  }

  const toggleTagPrivate = (index) => {
    const tags = [...(movie.tags || [])]
    tags[index] = { ...tags[index], is_private: !tags[index].is_private }
    save({ tags })
  }

  return (
    <Modal open={open} onClose={onClose} title={movie.title} large>
      {/* Backdrop */}
      {backdrop && (
        <div className="relative -mx-5 -mt-4 mb-4 h-44 md:h-56 overflow-hidden rounded-t-lg">
          <img src={backdrop} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12122e] via-[#12122e]/60 to-transparent" />
        </div>
      )}

      <div className="flex gap-4 mb-4">
        {poster && (
          <div className="shrink-0 w-28 md:w-32 rounded-xl overflow-hidden shadow-xl shadow-black/40 -mt-16 relative z-10 border border-white/10">
            <img src={poster} alt={movie.title} className="w-full aspect-[2/3] object-cover" />
          </div>
        )}
        <div className="flex-1 pt-1">
          <h3 className="text-xl font-bold leading-tight">{movie.title}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-white/50">
            {movie.year && <span>{movie.year}</span>}
            {movie.media_type && (
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] uppercase">
                {movie.media_type === 'tv' ? 'Serie' : 'Film'}
              </span>
            )}
            {movie.vote_average > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <HiStar className="w-3.5 h-3.5" />
                {movie.vote_average.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Overview */}
      {movie.overview && (
        <p className="text-sm text-white/60 leading-relaxed mb-4">{movie.overview}</p>
      )}

      {/* Streaming Providers */}
      {movie.tmdb_id && movie.media_type && (
        <div className="mb-4">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Verfügbar auf</label>
          <WatchProviders mediaType={movie.media_type} tmdbId={movie.tmdb_id} />
        </div>
      )}

      {/* Sonarr Status (TV only, installer/admin only) */}
      {movie.tmdb_id && movie.media_type === 'tv' && (user?.is_admin || user?.is_installer) && (
        <div className="mb-4">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Sonarr</label>
          <SonarrStatus tmdbId={movie.tmdb_id} title={movie.title} />
        </div>
      )}

      {/* Radarr Status (Movies only, installer/admin only) */}
      {movie.tmdb_id && movie.media_type === 'movie' && (user?.is_admin || user?.is_installer) && (
        <div className="mb-4">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Radarr</label>
          <RadarrStatus tmdbId={movie.tmdb_id} title={movie.title} />
        </div>
      )}

      {/* Status - always interactive */}
      {!readonly && (
        <div className="mb-4">
          <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Status</label>
          <div className="grid grid-cols-5 gap-1.5">
            {STATUS_OPTIONS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={`py-2 px-2 rounded-xl text-xs font-semibold text-center transition-all active:scale-95 ${
                  movie.status === value
                    ? `bg-gradient-to-r ${color} text-white shadow-lg`
                    : 'bg-white/[0.06] text-white/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {readonly && (
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-xl text-xs font-semibold bg-gradient-to-r ${STATUS_OPTIONS.find(s => s.value === movie.status)?.color || ''} text-white`}>
            {movie.status}
          </span>
        </div>
      )}

      {/* Rating - always interactive */}
      <div className="mb-4">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Bewertung</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(r => (
            <button
              key={r}
              onClick={() => !readonly && setRating(r)}
              disabled={readonly}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                (movie.rating || 0) >= r
                  ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                  : 'bg-white/[0.06] text-white/20'
              } ${!readonly ? 'active:scale-90 cursor-pointer' : ''}`}
            >
              <HiStar className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Season Tracker (TV only) */}
      {movie.media_type === 'tv' && movie.tmdb_id && (
        <div className="mb-4">
          <SeasonTracker
            tmdbId={movie.tmdb_id}
            progress={movie.watch_progress || {}}
            onChange={(wp, { totalWatched, totalEpisodes } = {}) => {
              const updates = { watch_progress: wp }
              // Auto-set status based on progress
              if (totalWatched !== undefined && totalEpisodes) {
                if (totalWatched === 0 && ['watching'].includes(movie.status)) {
                  updates.status = 'watchlist'
                } else if (totalWatched > 0 && totalWatched < totalEpisodes && ['watchlist', 'planned'].includes(movie.status)) {
                  updates.status = 'watching'
                } else if (totalWatched >= totalEpisodes && movie.status !== 'watched') {
                  updates.status = 'watched'
                }
              }
              save(updates)
            }}
            readonly={readonly}
          />
        </div>
      )}

      {/* Tags - inline editable */}
      <div className="mb-4">
        <button
          onClick={() => !readonly && setShowTags(!showTags)}
          className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1"
        >
          Tags
          {!readonly && <span className="text-primary-400/60 normal-case text-[10px]">(bearbeiten)</span>}
        </button>
        <div className="flex flex-wrap gap-1.5">
          {(movie.tags || []).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}30` }}
            >
              {tag.is_private && <HiLockClosed className="w-3 h-3 opacity-60" />}
              {tag.label}
              {showTags && !readonly && (
                <>
                  <button onClick={() => toggleTagPrivate(i)} className="ml-0.5 opacity-60 active:opacity-100">
                    {tag.is_private ? <HiLockOpen className="w-3 h-3" /> : <HiLockClosed className="w-3 h-3" />}
                  </button>
                  <button onClick={() => removeTag(i)} className="opacity-60 active:opacity-100">
                    <HiXMark className="w-3 h-3" />
                  </button>
                </>
              )}
            </span>
          ))}
          {(movie.tags || []).length === 0 && readonly && (
            <span className="text-xs text-white/20">Keine Tags</span>
          )}
        </div>

        {showTags && !readonly && (
          <div className="flex gap-2 items-center mt-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Neuer Tag..."
              className="glass-input py-2 text-sm flex-1"
            />
            <div className="flex gap-1 shrink-0">
              {TAG_COLORS.slice(0, 4).map(c => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${newTagColor === c ? 'ring-2 ring-white/50 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button onClick={addTag} className="w-8 h-8 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center shrink-0 active:scale-90">
              <HiPlus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Notes - tap to expand */}
      <div className="mb-4">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Notizen</label>
        {!readonly && showNotes ? (
          <div className="space-y-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Deine Notizen..."
              className="glass-input min-h-[80px] resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNotes(false)} className="glass-button flex-1 text-sm text-center">Abbrechen</button>
              <button onClick={saveNotes} className="btn-primary flex-1 text-sm py-2.5">Speichern</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { if (!readonly) { setNoteDraft(movie.notes || ''); setShowNotes(true) } }}
            className={`w-full text-left p-3 rounded-xl text-sm ${
              movie.notes
                ? 'bg-white/[0.04] text-white/50'
                : 'bg-white/[0.02] text-white/20'
            } ${!readonly ? 'active:bg-white/[0.06]' : ''}`}
          >
            {movie.notes || (readonly ? 'Keine Notizen' : 'Notizen hinzufügen...')}
          </button>
        )}
      </div>

      {/* Privacy + Delete */}
      {!readonly && (
        <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
          <button
            onClick={togglePrivate}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              movie.is_private
                ? 'bg-primary-500/20 text-primary-400 border border-primary-400/30'
                : 'bg-white/[0.04] text-white/40'
            }`}
          >
            {movie.is_private ? <HiLockClosed className="w-3.5 h-3.5" /> : <HiLockOpen className="w-3.5 h-3.5" />}
            {movie.is_private ? 'Privat' : 'Öffentlich'}
          </button>

          <div className="flex-1" />

          {onDelete && (
            <button
              onClick={() => { onDelete(movie.id); onClose() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 active:bg-red-500/20 transition-all"
            >
              <HiTrash className="w-3.5 h-3.5" />
              Löschen
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
