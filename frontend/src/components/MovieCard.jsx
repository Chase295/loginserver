import { HiStar } from 'react-icons/hi2'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const statusColors = {
  watchlist: 'from-blue-500 to-cyan-400',
  watching: 'from-purple-500 to-violet-400',
  watched: 'from-green-500 to-emerald-400',
  dropped: 'from-red-500 to-rose-400',
  planned: 'from-amber-500 to-yellow-400',
}

const statusLabels = {
  watchlist: 'Watchlist', watching: 'Schaue ich', watched: 'Gesehen',
  planned: 'Geplant', dropped: 'Abgebr.',
}

export default function MovieCard({ movie, onClick }) {
  const poster = movie.poster_url
    ? `${TMDB_IMG}/w342${movie.poster_url}`
    : null

  return (
    <div
      onClick={() => onClick?.(movie)}
      className="movie-card"
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
            <span className="text-3xl opacity-20">🎬</span>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Status badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r ${statusColors[movie.status] || statusColors.watchlist} text-white shadow-lg`}>
          {statusLabels[movie.status] || movie.status}
        </div>

        {/* Rating */}
        {movie.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/40 px-1.5 py-0.5 rounded-lg">
            <HiStar className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-medium">{movie.rating}</span>
          </div>
        )}

        {/* Private badge */}
        {movie.is_private && (
          <div className="absolute top-9 right-2 bg-black/40 px-1.5 py-0.5 rounded-lg">
            <span className="text-[10px] text-white/60">🔒</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="font-semibold text-sm truncate">{movie.title}</h3>
        <div className="flex items-center gap-2 mt-0.5">
          {movie.year && <span className="text-xs text-white/40">{movie.year}</span>}
          {movie.vote_average > 0 && (
            <span className="text-xs text-amber-400/80 flex items-center gap-0.5">
              <HiStar className="w-3 h-3" /> {movie.vote_average?.toFixed(1)}
            </span>
          )}
        </div>

        {/* Tags (max 2 visible) */}
        {movie.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {movie.tags.filter(t => !t.is_private).slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.label}
              </span>
            ))}
            {movie.tags.filter(t => !t.is_private).length > 2 && (
              <span className="text-[10px] text-white/30">+{movie.tags.filter(t => !t.is_private).length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
