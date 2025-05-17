import React, { useEffect, useState } from 'react';
import {
  Card,
  CardMedia,
  Box,
  Typography,
  Chip,
  IconButton
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import StarIcon from '@mui/icons-material/Star';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import DeleteIcon from '@mui/icons-material/Delete';

const statusConfig = {
  gesehen: {
    label: 'Gesehen',
    color: 'rgba(0,255,157,0.25)',
    text: '#00ff9d',
    icon: <CheckCircleIcon sx={{ color: '#00ff9d' }} />
  },
  am_schauen: {
    label: 'Am Schauen',
    color: 'rgba(0,183,255,0.25)',
    text: '#00b7ff',
    icon: <PlayCircleFilledWhiteIcon sx={{ color: '#00b7ff' }} />
  },
  abgebrochen: {
    label: 'Abgebrochen',
    color: 'rgba(255,0,98,0.25)',
    text: '#ff0062',
    icon: <PauseCircleFilledIcon sx={{ color: '#ff0062' }} />
  },
  watchlist: {
    label: 'Watchlist',
    color: 'rgba(255,255,255,0.10)',
    text: '#fff',
    icon: <WatchLaterIcon sx={{ color: '#fff' }} />
  }
};

const WatchlistCard = ({ movie, onDelete, onClick }) => {
  const [tmdbData, setTmdbData] = useState(null);
  const stat = statusConfig[movie.status] || statusConfig['watchlist'];

  useEffect(() => {
    const fetchDetails = async () => {
      if (!movie.tmdb_id || !movie.media_type) return;
      try {
        const res = await fetch(`/api/${movie.media_type}/${movie.tmdb_id}`);
        if (res.ok) {
          const data = await res.json();
          setTmdbData(data);
        }
      } catch (e) {
        setTmdbData(null);
      }
    };
    fetchDetails();
  }, [movie.tmdb_id, movie.media_type]);

  const item = {
    ...movie,
    ...(tmdbData || {})
  };

  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : (item.poster_url || 'https://via.placeholder.com/345x300');
  const title = item.title || item.name || '';
  const mediaType = item.media_type;

  return (
    <Card
      onClick={() => onClick(item)}
      sx={{
        position: 'relative',
        background: 'rgba(20, 20, 35, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.3)',
          '& .movie-image': {
            transform: 'scale(1.05)',
            filter: 'brightness(1.1)'
          },
        }
      }}
    >
      {/* Posterbild */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          className="movie-image"
          component="img"
          height="300"
          image={poster}
          alt={title}
          sx={{ 
            objectFit: 'cover',
            transition: 'transform 0.5s, filter 0.5s',
            zIndex: 1
          }}
        />
        {/* Delete-Button */}
        <IconButton
          onClick={e => { e.stopPropagation(); onDelete(movie.id); }}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            color: '#ff00ff',
            bgcolor: 'rgba(30,30,40,0.7)',
            zIndex: 2,
            '&:hover': {
              backgroundColor: 'rgba(255, 0, 255, 0.2)',
              color: '#fff'
            }
          }}
        >
          <DeleteIcon />
        </IconButton>
      </Box>
      {/* Info-Leiste wie Discovery */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 1,
        background: 'rgba(255,255,255,0.10)',
        borderBottom: '1px solid rgba(255,255,255,0.10)'
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
          {/* Bewertung */}
          {item.vote_average > 0 && (
            <Chip 
              label={
                item.vote_average >= 8 ? `⭐ ${Math.round(item.vote_average * 10) / 10}` :
                item.vote_average >= 7 ? `✨ ${Math.round(item.vote_average * 10) / 10}` :
                item.vote_average >= 6 ? `👍 ${Math.round(item.vote_average * 10) / 10}` :
                item.vote_average >= 5 ? `🙂 ${Math.round(item.vote_average * 10) / 10}` :
                `😕 ${Math.round(item.vote_average * 10) / 10}`
              }
              size="small"
              sx={{ 
                backgroundColor: 
                  item.vote_average >= 8 ? 'rgba(116, 0, 184, 0.9)' : 
                  item.vote_average >= 7 ? 'rgba(0, 128, 128, 0.9)' : 
                  item.vote_average >= 6 ? 'rgba(255, 152, 0, 0.9)' : 
                  item.vote_average >= 5 ? 'rgba(66, 66, 66, 0.9)' : 
                  'rgba(211, 47, 47, 0.9)',
                color: 'white',
                fontWeight: 'bold',
                backdropFilter: 'blur(3px)',
                '& .MuiChip-label': { px: 1 }
              }}
            />
          )}
          {/* Jahr */}
          <Chip
            size="small"
            label={item.release_date ? new Date(item.release_date).getFullYear() : item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'Unbekannt'}
            icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 'bold' }}
          />
          {/* Staffeln für Serien */}
          {mediaType === 'tv' && typeof item.number_of_seasons !== 'undefined' && (
            <Chip
              size="small"
              label={`${item.number_of_seasons} Staffel${item.number_of_seasons === 1 ? '' : 'n'}`}
              sx={{ bgcolor: 'rgba(66,133,244,0.15)', color: '#42a5f5', fontWeight: 'bold' }}
            />
          )}
          {/* Serien-Status */}
          {mediaType === 'tv' && item.status_de && (
            <Chip
              size="small"
              label={item.status_de}
              sx={{
                bgcolor: item.status_de === 'Laufend' ? 'rgba(0,255,157,0.15)' :
                         item.status_de === 'Abgeschlossen' ? 'rgba(144,0,255,0.15)' :
                         item.status_de === 'Abgebrochen' ? 'rgba(255,0,98,0.15)' :
                         'rgba(255,255,255,0.10)',
                color: item.status_de === 'Laufend' ? '#00ff9d' :
                       item.status_de === 'Abgeschlossen' ? '#9000ff' :
                       item.status_de === 'Abgebrochen' ? '#ff0062' :
                       '#fff',
                fontWeight: 'bold',
                minWidth: 110,
                justifyContent: 'center',
                textAlign: 'center'
              }}
            />
          )}
        </Box>
      </Box>
      {/* Titel */}
      <Box sx={{ bgcolor: '#000', padding: '12px', textAlign: 'center' }}>
        <Typography
          variant="h6"
          sx={{
            color: '#4e8cff',
            fontWeight: 'bold',
            fontSize: '1.2rem'
          }}
        >
          {title}
        </Typography>
      </Box>
      {/* User-Daten unter dem Titel */}
      <Box sx={{
        bgcolor: '#1a1a2e',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5
      }}>
        {/* Status, Sterne und Typ */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          justifyContent: 'center',
        }}>
          <Chip
            icon={stat.icon}
            label={stat.label}
            sx={{
              bgcolor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: `2px solid ${stat.text}`,
              fontWeight: 'bold',
              boxShadow: `0 0 10px ${stat.text}80`
            }}
          />
          {movie.rating > 0 && (
            <Chip
              icon={<StarIcon sx={{ color: '#FFD700' }} />}
              label={`${movie.rating}/10`}
              sx={{
                bgcolor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                fontWeight: 'bold',
                border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 0 10px rgba(255,215,0,0.3)'
              }}
            />
          )}
          <Chip
            icon={mediaType === 'tv' ? <TvIcon sx={{ color: 'cyan' }} /> : <MovieIcon sx={{ color: 'orange' }} />}
            label={mediaType === 'tv' ? 'Serie' : 'Film'}
            sx={{
              bgcolor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              fontWeight: 'bold',
              border: `2px solid ${mediaType === 'tv' ? 'rgba(0,255,255,0.5)' : 'rgba(255,165,0,0.5)'}`,
              boxShadow: `0 0 10px ${mediaType === 'tv' ? 'rgba(0,255,255,0.3)' : 'rgba(255,165,0,0.3)'}`
            }}
          />
        </Box>
        {/* Tags Liste */}
        {Array.isArray(movie.tags) && movie.tags.length > 0 && (
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'center'
          }}>
            {movie.tags.map((tag, idx) => (
              <Chip
                key={idx}
                label={tag.label}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,0,255,0.2)',
                  color: '#fff',
                  border: '1px solid #ff00ff',
                  fontWeight: 'bold'
                }}
              />
            ))}
          </Box>
        )}
        {/* Notes/Kommentare */}
        {movie.notes && (
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}
          >
            {movie.notes}
          </Typography>
        )}
      </Box>
    </Card>
  );
};

export default WatchlistCard;