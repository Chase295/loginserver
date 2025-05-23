import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Box,
  Tooltip,
  Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

const MovieCard = ({ movie, onDelete }) => {
  const [movieData, setMovieData] = useState(movie);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMovieData = async () => {
      if (!movie.tmdb_id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/movie/${movie.tmdb_id}?type=${movie.media_type}`);
        const data = await response.json();
        if (data) {
          setMovieData(prevData => ({
            ...prevData,
            ...data,
            // Behalte lokale Daten bei
            status: prevData.status,
            rating: prevData.rating,
            notes: prevData.notes,
            tags: prevData.tags
          }));
        }
      } catch (error) {
        console.error('Fehler beim Abrufen der Filmdaten:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieData();
    // Aktualisiere alle 5 Minuten
    const interval = setInterval(fetchMovieData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [movie.tmdb_id, movie.media_type]);

  // Konsistente Feldnamen verwenden (poster_url oder posterUrl)
  const posterUrl = movieData.poster_url || movieData.posterUrl || 'https://via.placeholder.com/345x200';
  const mediaType = movieData.media_type || movieData.mediaType || 'movie';
  const title = movieData.title || '';
  const voteAverage = movieData.vote_average || movieData.voteAverage || 0;
  const status = movieData.status || 'watchlist';
  const rating = movieData.rating || 0;
  const notes = movieData.notes || '';
  const tags = movieData.tags || [];
  
  // Status-Icon und Farbe
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
  const stat = statusConfig[status] || statusConfig['watchlist'];
  
  return (
    <Card
      sx={{
        maxWidth: 345,
        background: 'transparent',
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.3)',
          '& .movie-image': {
            transform: 'scale(1.05)',
            filter: 'brightness(1.1)'
          }
        }
      }}
    >
      {/* Posterbild */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <CardMedia
          className="movie-image"
          component="img"
          height="380"
          image={posterUrl}
          alt={title}
          sx={{
            objectFit: 'cover',
            transition: 'transform 0.5s, filter 0.5s',
            zIndex: 1
          }}
        />
        
        {/* Delete-Button als Icon oben rechts */}
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            onDelete(movieData.id);
          }}
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
      
      {/* Unterer schwarzer Balken mit Titel */}
      <Box sx={{
        bgcolor: '#000',
        padding: '12px',
        textAlign: 'center'
      }}>
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
      
      {/* Info-Leiste mit echten Werten des Films/der Serie */}
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
          {/* TMDB Bewertung */}
          {voteAverage > 0 && (
            <Chip 
              label={
                voteAverage >= 8 ? `⭐ ${Math.round(voteAverage * 10) / 10}` :
                voteAverage >= 7 ? `✨ ${Math.round(voteAverage * 10) / 10}` :
                voteAverage >= 6 ? `👍 ${Math.round(voteAverage * 10) / 10}` :
                voteAverage >= 5 ? `🙂 ${Math.round(voteAverage * 10) / 10}` :
                `😕 ${Math.round(voteAverage * 10) / 10}`
              }
              size="small"
              sx={{ 
                backgroundColor: 
                  voteAverage >= 8 ? 'rgba(116, 0, 184, 0.9)' : 
                  voteAverage >= 7 ? 'rgba(0, 128, 128, 0.9)' : 
                  voteAverage >= 6 ? 'rgba(255, 152, 0, 0.9)' : 
                  voteAverage >= 5 ? 'rgba(66, 66, 66, 0.9)' : 
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
            label={movieData.release_date ? new Date(movieData.release_date).getFullYear() : movieData.first_air_date ? new Date(movieData.first_air_date).getFullYear() : 'Unbekannt'}
            icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 'bold' }}
          />
          {/* Staffeln für Serien */}
          {mediaType === 'tv' && typeof movieData.number_of_seasons !== 'undefined' && (
            <Chip
              size="small"
              label={`${movieData.number_of_seasons} Staffel${movieData.number_of_seasons === 1 ? '' : 'n'}`}
              sx={{ bgcolor: 'rgba(66,133,244,0.15)', color: '#42a5f5', fontWeight: 'bold' }}
            />
          )}
          {/* Serien-Status */}
          {mediaType === 'tv' && movieData.status_de && (
            <Chip
              size="small"
              label={movieData.status_de}
              sx={{
                bgcolor: movieData.status_de === 'Laufend' ? 'rgba(0,255,157,0.15)' :
                         movieData.status_de === 'Abgeschlossen' ? 'rgba(144,0,255,0.15)' :
                         movieData.status_de === 'Abgebrochen' ? 'rgba(255,0,98,0.15)' :
                         'rgba(255,255,255,0.10)',
                color: movieData.status_de === 'Laufend' ? '#00ff9d' :
                       movieData.status_de === 'Abgeschlossen' ? '#9000ff' :
                       movieData.status_de === 'Abgebrochen' ? '#ff0062' :
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
      
      {/* Status-Badges und Tags unter dem Titel */}
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
          
          {rating > 0 && (
            <Chip
              icon={<StarIcon sx={{ color: '#FFD700' }} />}
              label={`${rating}/10`}
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
        {tags && tags.length > 0 && (
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'center'
          }}>
            {tags.map((tag, idx) => (
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
        {notes && (
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}
          >
            {notes}
          </Typography>
        )}
      </Box>
    </Card>
  );
};

export default MovieCard; 