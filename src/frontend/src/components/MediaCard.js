import React from 'react';
import {
  Card,
  CardMedia,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import StarIcon from '@mui/icons-material/Star';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';

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

const MediaCard = ({ 
  item, 
  onAdd, 
  showAddButton = false, 
  userData = {}, 
  onClick, 
  onDelete,
  isGroupWatchlist = false 
}) => {
  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : (item.poster_url || 'https://via.placeholder.com/345x300');
  const title = item.title || item.name || '';
  const mediaType = item.media_type;
  const stat = statusConfig[userData.status] || statusConfig['watchlist'];
  
  // Detaillierter Debug output für Tags
  console.log('MediaCard Tags Detailed Debug:', {
    title,
    tags: userData.tags ? userData.tags.map(tag => ({
      fullTag: tag,
      label: tag.label,
      color: tag.color,
      isPrivate: tag.is_private
    })) : [],
    isPrivate: item.is_private,
    hasPrivateTag: userData.tags && userData.tags.some(tag => tag.is_private === true)
  });

  // Prüfe ob der Titel oder ein Tag privat ist
  const isPrivate = item.is_private || (userData.tags && userData.tags.some(tag => 
    tag.is_private === true
  ));

  // Filtere die anzuzeigenden Tags
  const visibleTags = userData.tags ? userData.tags.filter(tag => {
    // In der privaten Watchlist alle Tags anzeigen
    if (!isGroupWatchlist) return true;
    // In der Gruppen-Watchlist nur öffentliche Tags anzeigen
    return !tag.is_private;
  }) : [];
  
  // Debug output
  console.log('MediaCard Debug:', {
    title,
    tags: visibleTags,
    isPrivate,
    isGroupWatchlist
  });

  return (
    <Card
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
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(item);
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
        {/* Plus-Button nur wenn showAddButton */}
        {showAddButton && (
          <IconButton
            className="add-icon"
            onClick={e => { e.stopPropagation(); onAdd && onAdd(item); }}
            aria-label="zur Watchlist hinzufügen"
            sx={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              opacity: 1,
              transform: 'rotate(0deg) scale(1)',
              bgcolor: 'rgba(255, 215, 0, 0.9)',
              color: '#000',
              '&:hover': {
                bgcolor: 'rgba(255, 215, 0, 1)',
                transform: 'rotate(0deg) scale(1.1) !important'
              }
            }}
          >
            <AddIcon />
          </IconButton>
        )}
        {/* Delete-Button nur wenn onDelete übergeben */}
        {typeof onDelete === 'function' && (
          <IconButton
            className="delete-icon"
            onClick={e => { e.stopPropagation(); onDelete(item); }}
            aria-label="aus Watchlist entfernen"
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              bgcolor: 'rgba(255,0,98,0.25)',
              color: 'rgba(255,255,255,0.7)',
              zIndex: 2,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'rgba(255,0,98,0.4)',
                color: '#fff'
              }
            }}
          >
            <DeleteIcon sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        )}
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
          {/* TMDB Bewertung */}
          {item.vote_average && (
              <Chip
                size="small"
                icon={<StarIcon sx={{ color: '#FFD700' }} />}
              label={`${parseFloat(item.vote_average).toFixed(1)}/10`}
                sx={{
                  bgcolor: 'rgba(255, 215, 0, 0.15)',
                  color: '#FFD700',
                  fontWeight: 'bold',
                  border: '1px solid rgba(255, 215, 0, 0.3)'
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
          {/* Folgen für Serien */}
          {mediaType === 'tv' && typeof item.number_of_episodes !== 'undefined' && (
            <Chip
              size="small"
              label={`${item.number_of_episodes} Folge${item.number_of_episodes === 1 ? '' : 'n'}`}
              sx={{ bgcolor: 'rgba(255,193,7,0.15)', color: '#ffc107', fontWeight: 'bold' }}
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
      <Box sx={{ 
        bgcolor: '#000', 
        padding: '12px', 
        textAlign: 'center',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1
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
        {isPrivate && (
          <Tooltip title="Dieser Titel ist privat">
            <LockIcon 
              sx={{ 
                color: '#ff0062',
                fontSize: '1.2rem',
                opacity: 0.8,
                transition: 'all 0.2s ease',
                '&:hover': {
                  opacity: 1,
                  transform: 'scale(1.1)'
                }
              }} 
            />
          </Tooltip>
        )}
      </Box>
      {/* Userdaten unter dem Titel, falls vorhanden */}
      {(userData.status || userData.rating > 0 || (Array.isArray(userData.tags) && userData.tags.length > 0) || userData.notes) && (
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
            {userData.status && (
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
            )}
            {userData.rating > 0 && (
              <Chip
                icon={<StarIcon sx={{ color: '#FFD700' }} />}
                label={`${userData.rating}/10`}
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
          {Array.isArray(visibleTags) && visibleTags.length > 0 && (
            <Box sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'center'
            }}>
              {visibleTags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag.label}
                  size="small"
                  sx={{
                    bgcolor: tag.is_private ? 'rgba(255,0,255,0.2)' : 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    border: `1px solid ${tag.is_private ? '#ff00ff' : '#ffffff'}`,
                    fontWeight: 'bold'
                  }}
                />
              ))}
            </Box>
          )}
          {/* Notes/Kommentare */}
          {userData.notes && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255,255,255,0.7)',
                fontStyle: 'italic',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}
            >
              {userData.notes}
            </Typography>
          )}
        </Box>
      )}
    </Card>
  );
};

export default MediaCard; 