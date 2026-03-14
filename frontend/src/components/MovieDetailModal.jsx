import { useState } from 'react'
import { HiStar, HiTrash, HiEye, HiLockClosed, HiLockOpen, HiPlus, HiXMark } from 'react-icons/hi2'
import Modal from './Modal'
import SeasonTracker from './SeasonTracker'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const STATUS_OPTIONS = [
  { value: 'watchlist', label: 'Watchlist', color: 'from-blue-500 to-cyan-400' },
  { value: 'watched', label: 'Watched', color: 'from-green-500 to-emerald-400' },
  { value: 'planned', label: 'Planned', color: 'from-amber-500 to-yellow-400' },
  { value: 'dropped', label: 'Dropped', color: 'from-red-500 to-rose-400' },
]

const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']

export default function MovieDetailModal({ movie, open, onClose, onUpdate, onDelete, readonly }) {
  const [editData, setEditData] = useState(null)
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  if (!movie) return null

  const data = editData || movie
  const backdrop = movie.backdrop_path ? `${TMDB_IMG}/w780${movie.backdrop_path}` : null
  const poster = movie.poster_url ? `${TMDB_IMG}/w342${movie.poster_url}` : null
  const isEditing = !!editData

  const startEdit = () => setEditData({ ...movie })
  const cancelEdit = () => setEditData(null)

  const saveEdit = () => {
    if (!editData || !onUpdate) return
    onUpdate(movie.id, {
      status: editData.status,
      rating: editData.rating,
      notes: editData.notes,
      is_private: editData.is_private,
      tags: editData.tags,
      watch_progress: editData.watch_progress,
    })
    setEditData(null)
    onClose()
  }

  const addTag = () => {
    if (!newTag.trim() || !editData) return
    const tag = { label: newTag.trim(), color: newTagColor, is_private: false }
    setEditData({ ...editData, tags: [...(editData.tags || []), tag] })
    setNewTag('')
  }

  const removeTag = (index) => {
    if (!editData) return
    setEditData({ ...editData, tags: editData.tags.filter((_, i) => i !== index) })
  }

  const toggleTagPrivate = (index) => {
    if (!editData) return
    const tags = [...editData.tags]
    tags[index] = { ...tags[index], is_private: !tags[index].is_private }
    setEditData({ ...editData, tags })
  }

  return (
    <Modal open={open} onClose={onClose} title={movie.title} large>
      {/* Backdrop image */}
      {backdrop && (
        <div className="relative -mx-5 -mt-4 mb-4 h-44 md:h-56 overflow-hidden rounded-t-lg">
          <img src={backdrop} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12122e] via-[#12122e]/60 to-transparent" />
        </div>
      )}

      <div className="flex gap-4 mb-4">
        {/* Poster */}
        {poster && (
          <div className="shrink-0 w-28 md:w-32 rounded-xl overflow-hidden shadow-xl shadow-black/40 -mt-16 relative z-10 border border-white/10">
            <img src={poster} alt={movie.title} className="w-full aspect-[2/3] object-cover" />
          </div>
        )}

        {/* Quick info */}
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
        <div className="mb-4">
          <p className="text-sm text-white/60 leading-relaxed">{movie.overview}</p>
        </div>
      )}

      {/* Status */}
      <div className="mb-4">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Status</label>
        <div className="grid grid-cols-4 gap-2">
          {STATUS_OPTIONS.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => isEditing && setEditData({ ...editData, status: value })}
              disabled={!isEditing && !readonly}
              className={`py-2 px-2 rounded-xl text-xs font-semibold text-center transition-all ${
                data.status === value
                  ? `bg-gradient-to-r ${color} text-white shadow-lg`
                  : 'bg-white/[0.06] text-white/40'
              } ${isEditing ? 'active:scale-95 cursor-pointer' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className="mb-4">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Bewertung</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(r => (
            <button
              key={r}
              onClick={() => isEditing && setEditData({ ...editData, rating: editData.rating === r ? null : r })}
              disabled={!isEditing}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                (data.rating || 0) >= r
                  ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30 shadow-lg shadow-amber-400/10'
                  : 'bg-white/[0.06] text-white/20'
              } ${isEditing ? 'active:scale-90 cursor-pointer' : ''}`}
            >
              <HiStar className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="mb-4">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(data.tags || []).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}30` }}
            >
              {tag.is_private && <HiLockClosed className="w-3 h-3 opacity-60" />}
              {tag.label}
              {isEditing && (
                <>
                  <button onClick={() => toggleTagPrivate(i)} className="ml-0.5 opacity-60 hover:opacity-100">
                    {tag.is_private ? <HiLockOpen className="w-3 h-3" /> : <HiLockClosed className="w-3 h-3" />}
                  </button>
                  <button onClick={() => removeTag(i)} className="opacity-60 hover:opacity-100">
                    <HiXMark className="w-3 h-3" />
                  </button>
                </>
              )}
            </span>
          ))}
          {(data.tags || []).length === 0 && !isEditing && (
            <span className="text-xs text-white/20">Keine Tags</span>
          )}
        </div>

        {/* Add tag (edit mode) */}
        {isEditing && (
          <div className="flex gap-2 items-center">
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

      {/* Season Tracker (TV only) */}
      {movie.media_type === 'tv' && movie.tmdb_id && (
        <div className="mb-4">
          <SeasonTracker
            tmdbId={movie.tmdb_id}
            progress={isEditing ? (editData.watch_progress || {}) : (movie.watch_progress || {})}
            onChange={(wp) => {
              if (isEditing) {
                setEditData({ ...editData, watch_progress: wp })
              } else if (onUpdate) {
                onUpdate(movie.id, { watch_progress: wp })
              }
            }}
            readonly={readonly}
          />
        </div>
      )}

      {/* Notes */}
      <div className="mb-4">
        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Notizen</label>
        {isEditing ? (
          <textarea
            value={editData.notes || ''}
            onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            placeholder="Deine Notizen zum Film..."
            className="glass-input min-h-[80px] resize-none text-sm"
          />
        ) : (
          <p className="text-sm text-white/50">
            {data.notes || <span className="text-white/20">Keine Notizen</span>}
          </p>
        )}
      </div>

      {/* Privacy toggle */}
      {isEditing && (
        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-white/[0.04]">
          <button
            onClick={() => setEditData({ ...editData, is_private: !editData.is_private })}
            className={`relative w-12 h-7 rounded-full transition-colors ${editData.is_private ? 'bg-primary-500' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${editData.is_private ? 'left-6' : 'left-1'}`} />
          </button>
          <div>
            <span className="text-sm font-medium">{editData.is_private ? 'Privat' : 'Öffentlich'}</span>
            <p className="text-[11px] text-white/30">
              {editData.is_private ? 'Freunde können diesen Film nicht sehen' : 'Sichtbar für Freunde'}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!readonly && (
        <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
          {isEditing ? (
            <>
              <button onClick={cancelEdit} className="glass-button flex-1 text-sm text-center">Abbrechen</button>
              <button onClick={saveEdit} className="btn-primary flex-1 text-sm py-2.5">Speichern</button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="btn-primary flex-1 text-sm py-2.5">Bearbeiten</button>
              {onUpdate && data.status !== 'watched' && (
                <button
                  onClick={() => { onUpdate(movie.id, { status: 'watched' }); onClose() }}
                  className="glass-button flex-1 text-sm text-center text-green-400"
                >
                  <HiEye className="w-4 h-4 inline mr-1.5" />Gesehen
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { onDelete(movie.id); onClose() }}
                  className="glass-button px-3 text-red-400"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
