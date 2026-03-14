import { motion } from 'framer-motion'
import { HiStar, HiEye, HiTrash, HiPencil } from 'react-icons/hi2'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const statusColors = {
  watchlist: 'from-blue-500 to-cyan-400',
  watched: 'from-green-500 to-emerald-400',
  dropped: 'from-red-500 to-rose-400',
  planned: 'from-amber-500 to-yellow-400',
}

export default function MovieCard({ movie, onUpdate, onDelete, onEdit, readonly }) {
  const poster = movie.poster_url
    ? `${TMDB_IMG}/w342${movie.poster_url}`
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="movie-card group"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {poster ? (
          <img
            src={poster}
            alt={movie.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-900 to-purple-900 flex items-center justify-center">
            <HiFilm className="w-12 h-12 text-white/20" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Status badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r ${statusColors[movie.status] || statusColors.watchlist} text-white shadow-lg`}>
          {movie.status}
        </div>

        {/* Rating */}
        {movie.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 glass-light px-1.5 py-0.5 rounded-lg">
            <HiStar className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-medium">{movie.rating}</span>
          </div>
        )}

        {/* Private badge */}
        {movie.is_private && (
          <div className="absolute top-9 right-2 glass-light px-1.5 py-0.5 rounded-lg">
            <span className="text-[10px] text-white/60">Privat</span>
          </div>
        )}

        {/* Actions overlay */}
        {!readonly && (
          <div className="absolute bottom-0 left-0 right-0 p-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {onEdit && (
              <button onClick={() => onEdit(movie)} className="glass-button p-2 rounded-lg">
                <HiPencil className="w-4 h-4" />
              </button>
            )}
            {onUpdate && movie.status !== 'watched' && (
              <button
                onClick={() => onUpdate(movie.id, { status: 'watched' })}
                className="glass-button p-2 rounded-lg"
              >
                <HiEye className="w-4 h-4 text-green-400" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(movie.id)} className="glass-button p-2 rounded-lg ml-auto">
                <HiTrash className="w-4 h-4 text-red-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">{movie.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          {movie.year && <span className="text-xs text-white/40">{movie.year}</span>}
          {movie.vote_average > 0 && (
            <span className="text-xs text-amber-400/80">
              <HiStar className="inline w-3 h-3 -mt-0.5" /> {movie.vote_average?.toFixed(1)}
            </span>
          )}
        </div>

        {/* Tags */}
        {movie.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {movie.tags.filter(t => !t.is_private).map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function HiFilm(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  )
}
