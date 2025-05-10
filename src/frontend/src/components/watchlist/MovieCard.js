import React from 'react';
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

const MovieCard = ({ movie, onDelete }) => {
  // Konsistente Feldnamen verwenden (poster_url oder posterUrl)
  const posterUrl = movie.poster_url || movie.posterUrl || 'https://via.placeholder.com/345x200';
  const mediaType = movie.media_type || movie.mediaType || 'movie';
  const title = movie.title || '';
  const voteAverage = movie.vote_average || movie.voteAverage || 0;
  
  return (
    <Card
      sx={{
        maxWidth: 345,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'transform 0.2s',
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        '&:hover': {
          transform: 'scale(1.02)',
          boxShadow: '0 0 20px rgba(0, 255, 157, 0.2)'
        }
      }}
    >
      <CardMedia
        component="img"
        height="200"
        image={posterUrl}
        alt={title}
        sx={{
          objectFit: 'cover'
        }}
      />
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography
            gutterBottom
            variant="h6"
            component="div"
            sx={{
              color: '#00ff9d',
              fontWeight: 'bold'
            }}
          >
            {title}
          </Typography>
          <IconButton
            onClick={() => onDelete(movie.id)}
            sx={{
              color: '#ff00ff',
              padding: '4px',
              '&:hover': {
                backgroundColor: 'rgba(255, 0, 255, 0.1)'
              }
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Chip 
            icon={mediaType === 'tv' ? <TvIcon fontSize="small" /> : <MovieIcon fontSize="small" />}
            label={mediaType === 'tv' ? 'Serie' : 'Film'}
            size="small"
            sx={{ 
              backgroundColor: mediaType === 'tv' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 165, 0, 0.2)',
              color: mediaType === 'tv' ? 'cyan' : 'orange',
              mr: 1
            }}
          />
          {voteAverage > 0 && (
            <Tooltip title="Bewertung">
              <Chip
                icon={<StarIcon fontSize="small" />}
                label={voteAverage}
                size="small"
                sx={{ 
                  backgroundColor: 'rgba(255, 215, 0, 0.2)',
                  color: 'gold'
                }}
              />
            </Tooltip>
          )}
        </Box>
        
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            mt: 'auto'
          }}
        >
          {movie.year && `Jahr: ${movie.year}`}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default MovieCard; 