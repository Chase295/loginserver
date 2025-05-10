import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Modal,
  Backdrop,
  Fade,
  Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import StarIcon from '@mui/icons-material/Star';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const Discover = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contentType, setContentType] = useState(
    localStorage.getItem('preferredContentType') || 'movie'
  );
  const [displayMode, setDisplayMode] = useState(
    localStorage.getItem('preferredDisplayMode') || 'trending'
  );
  const [success, setSuccess] = useState(null);
  
  // Zustand für die Detailansicht
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Lade die initialen Daten basierend auf den Präferenzen
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    loadContent();
  }, [contentType, displayMode]);

  // Lade Trending oder Upcoming Inhalte
  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      // API-Endpunkt basierend auf displayMode wählen
      const endpoint = displayMode === 'trending' ? 'trending' : 'upcoming';
      
      const response = await fetch(`http://localhost:8000/api/${endpoint}?type=${contentType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Inhalte');
      }
      
      const data = await response.json();
      setContent(data.results || []);
    } catch (err) {
      console.error('Fehler:', err);
      setError('Fehler beim Laden der Inhalte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Suche nach Inhalten
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8000/api/search?q=${encodeURIComponent(searchTerm)}&type=${contentType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Fehler bei der Suche');
      }
      
      const data = await response.json();
      setContent(data.results || []);
    } catch (err) {
      console.error('Fehler:', err);
      setError('Fehler bei der Suche: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Inhalt zur Watchlist hinzufügen
  const handleAddToWatchlist = async (item) => {
    try {
      setError(null);
      setSuccess(null);
      
      const token = localStorage.getItem('token');
      const movieData = {
        title: item.title || item.name,
        year: item.release_date 
          ? new Date(item.release_date).getFullYear() 
          : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : null),
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        tmdb_id: item.id.toString(),
        media_type: contentType,
        backdrop_path: item.backdrop_path,
        overview: item.overview,
        vote_average: item.vote_average
      };
      
      // Sicherstellen, dass keine undefined oder null Werte bleiben
      Object.keys(movieData).forEach(key => {
        if (movieData[key] === undefined || movieData[key] === null) {
          delete movieData[key];
        }
      });
      
      const response = await fetch('http://localhost:8000/api/watchlist/movies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(movieData)
      });

      if (!response.ok) {
        throw new Error('Fehler beim Hinzufügen zur Watchlist');
      }
      
      // Erfolgsmeldung anzeigen
      setSuccess(`"${movieData.title}" wurde zur Watchlist hinzugefügt.`);
      
      // Nach 3 Sekunden Erfolgsmeldung ausblenden
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
      
      // Nach 3 Sekunden Fehlermeldung ausblenden
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };
  
  // Öffne die Detailansicht eines Films/einer Serie
  const handleOpenDetail = (item) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
  };
  
  // Schließe die Detailansicht
  const handleCloseDetail = () => {
    setDetailModalOpen(false);
  };

  if (loading && content.length === 0) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(45deg, #0a1929 30%, #1a2027 90%)'
        }}
      >
        <CircularProgress sx={{ color: '#00ff9d' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)',
        py: 4,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255, 0, 128, 0.2) 0%, rgba(255, 140, 0, 0.1) 25%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(0, 128, 255, 0.2) 0%, rgba(128, 0, 255, 0.1) 25%, transparent 50%)',
          zIndex: 0,
          animation: 'gradientAnimation 15s ease infinite alternate',
          '@keyframes gradientAnimation': {
            '0%': {
              opacity: 0.7,
              transform: 'scale(1) rotate(0deg)'
            },
            '50%': {
              opacity: 0.5,
              transform: 'scale(1.1) rotate(3deg)'
            },
            '100%': {
              opacity: 0.7,
              transform: 'scale(1) rotate(0deg)'
            }
          }
        }
      }}
    >
      <Container 
        maxWidth="lg" 
        sx={{ 
          position: 'relative', 
          zIndex: 1 
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/watchlist')}
          sx={{
            color: '#00ff9d',
            mb: 4,
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 157, 0.1)'
            }
          }}
        >
          Zurück zur Watchlist
        </Button>

        {/* Erfolgsmeldung */}
        {success && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 9999,
              background: 'rgba(0, 255, 157, 0.9)',
              color: '#0a1929',
              p: 2,
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              maxWidth: 350,
              fontWeight: 'bold'
            }}
          >
            {success}
          </Box>
        )}

        <Paper
          elevation={3}
          sx={{
            p: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            mb: 4
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              color: '#00ff9d',
              textAlign: 'center',
              mb: 2
            }}
          >
            Filme & Serien entdecken
          </Typography>

          {/* Filterleiste mit Chips statt Tabs */}
          <Box 
            sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 2, 
              justifyContent: 'center',
              mb: 4,
              position: 'relative',
              p: 2,
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '16px',
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Displaymodus-Chips */}
            <Chip
              icon={<TrendingUpIcon />}
              label="🔥 Trending"
              onClick={() => {
                setDisplayMode('trending');
                localStorage.setItem('preferredDisplayMode', 'trending');
              }}
              sx={{
                bgcolor: displayMode === 'trending' ? 'rgba(255, 0, 98, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderColor: displayMode === 'trending' ? '#ff0062' : 'transparent',
                border: '2px solid',
                fontWeight: displayMode === 'trending' ? 'bold' : 'normal',
                transition: 'all 0.3s ease',
                transform: displayMode === 'trending' ? 'scale(1.05)' : 'scale(1)',
                '&:hover': {
                  bgcolor: 'rgba(255, 0, 98, 0.6)',
                  transform: 'scale(1.05)'
                }
              }}
            />
            <Chip
              icon={<NewReleasesIcon />}
              label="✨ Neu & Kommend"
              onClick={() => {
                setDisplayMode('upcoming');
                localStorage.setItem('preferredDisplayMode', 'upcoming');
              }}
              sx={{
                bgcolor: displayMode === 'upcoming' ? 'rgba(144, 0, 255, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderColor: displayMode === 'upcoming' ? '#9000ff' : 'transparent',
                border: '2px solid',
                fontWeight: displayMode === 'upcoming' ? 'bold' : 'normal',
                transition: 'all 0.3s ease',
                transform: displayMode === 'upcoming' ? 'scale(1.05)' : 'scale(1)',
                '&:hover': {
                  bgcolor: 'rgba(144, 0, 255, 0.6)',
                  transform: 'scale(1.05)'
                }
              }}
            />
            
            <Box sx={{ width: '100%', my: 1, height: '2px', background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%)' }} />
            
            {/* Medientyp-Chips */}
            <Chip
              icon={<MovieIcon />}
              label="🎬 Filme"
              onClick={() => {
                setContentType('movie');
                localStorage.setItem('preferredContentType', 'movie');
              }}
              sx={{
                bgcolor: contentType === 'movie' ? 'rgba(0, 183, 255, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderColor: contentType === 'movie' ? '#00b7ff' : 'transparent',
                border: '2px solid',
                fontWeight: contentType === 'movie' ? 'bold' : 'normal',
                transition: 'all 0.3s ease',
                transform: contentType === 'movie' ? 'scale(1.05)' : 'scale(1)',
                '&:hover': {
                  bgcolor: 'rgba(0, 183, 255, 0.6)',
                  transform: 'scale(1.05)'
                }
              }}
            />
            <Chip
              icon={<TvIcon />}
              label="📺 Serien"
              onClick={() => {
                setContentType('tv');
                localStorage.setItem('preferredContentType', 'tv');
              }}
              sx={{
                bgcolor: contentType === 'tv' ? 'rgba(255, 123, 0, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderColor: contentType === 'tv' ? '#ff7b00' : 'transparent',
                border: '2px solid',
                fontWeight: contentType === 'tv' ? 'bold' : 'normal',
                transition: 'all 0.3s ease',
                transform: contentType === 'tv' ? 'scale(1.05)' : 'scale(1)',
                '&:hover': {
                  bgcolor: 'rgba(255, 123, 0, 0.6)',
                  transform: 'scale(1.05)'
                }
              }}
            />
          </Box>

          {/* Suchfeld */}
          <Box 
            component="form" 
            onSubmit={handleSearch}
            sx={{ 
              display: 'flex', 
              gap: 2, 
              mb: 4,
              position: 'relative',
              p: 2,
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '16px',
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
              '&:focus-within': {
                boxShadow: '0 0 15px rgba(255, 140, 0, 0.4)',
                borderColor: 'rgba(255, 140, 0, 0.6)',
              }
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              placeholder={contentType === 'movie' ? '🔍 Film suchen...' : '🔍 Serie suchen...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  borderRadius: '12px',
                  transition: 'all 0.3s',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: '2px',
                  },
                  '&:hover fieldset': {
                    borderColor: '#ff8c00',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff8c00',
                    borderWidth: '2px',
                  },
                  '&.Mui-focused': {
                    boxShadow: '0 0 10px rgba(255, 140, 0, 0.3)'
                  }
                },
                '& .MuiInputBase-input::placeholder': {
                  opacity: 0.8,
                  color: 'rgba(255, 255, 255, 0.7)'
                }
              }}
              InputProps={{
                sx: {
                  fontSize: '1.1rem',
                  fontWeight: '500'
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<SearchIcon />}
              sx={{
                backgroundColor: '#ff8c00',
                color: '#000',
                borderRadius: '12px',
                fontWeight: 'bold',
                minWidth: '120px',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: '#ff6a00',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 5px 15px rgba(255, 106, 0, 0.4)'
                },
                '&:active': {
                  transform: 'translateY(1px)',
                }
              }}
            >
              Suchen
            </Button>
          </Box>

          {/* Fehleranzeige */}
          {error && (
            <Box
              sx={{
                background: 'rgba(255, 0, 0, 0.1)',
                color: '#ff4d4d',
                p: 2,
                borderRadius: 2,
                mb: 3,
                textAlign: 'center'
              }}
            >
              <Typography>
                {error}
              </Typography>
            </Box>
          )}

          {/* Zusätzlicher Ladezustand wenn Inhalte bereits angezeigt werden */}
          {loading && content.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <CircularProgress sx={{ color: '#00ff9d' }} size={40} />
            </Box>
          )}

          {/* Ergebnisse */}
          <Grid container spacing={3}>
            {content.map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.id}>
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
                      '& .add-icon': {
                        opacity: 1,
                        transform: 'rotate(0deg) scale(1)',
                      },
                      '& .movie-title': {
                        background: 'linear-gradient(45deg, #FF5757, #8C52FF)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }
                    }
                  }}
                  onClick={() => handleOpenDetail(item)}
                >
                  {/* Dynamischer Hintergrundverlauf basierend auf Bewertung */}
                  <Box 
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '100%',
                      opacity: 0.4,
                      background: 
                        item.vote_average >= 8 ? 'linear-gradient(135deg, #3C1053, #7D1EA2, #AD38AE)' : 
                        item.vote_average >= 7 ? 'linear-gradient(135deg, #134E5E, #71B280)' : 
                        item.vote_average >= 6 ? 'linear-gradient(135deg, #FF8008, #FFC837)' : 
                        item.vote_average >= 5 ? 'linear-gradient(135deg, #F3904F, #3B4371)' : 
                        'linear-gradient(135deg, #A71D31, #3F0D12)',
                      zIndex: 0
                    }}
                  />
                  
                  {/* Film-Bild mit Hover-Effekt */}
                  <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                    <CardMedia
                      className="movie-image"
                      component="img"
                      height="300"
                      image={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/345x300'}
                      alt={item.title || item.name}
                      sx={{ 
                        objectFit: 'cover',
                        transition: 'transform 0.5s, filter 0.5s',
                        zIndex: 1
                      }}
                    />
                    
                    {/* Bewertungsschilder */}
                    <Box 
                      sx={{ 
                        position: 'absolute', 
                        top: 10, 
                        right: 10, 
                        zIndex: 2,
                        display: 'flex',
                        gap: '5px',
                        flexDirection: 'column',
                        alignItems: 'flex-end'
                      }}
                    >
                      {/* Medientyp-Chip */}
                      <Chip 
                        label={contentType === 'tv' ? '📺 Serie' : '🎬 Film'}
                        size="small"
                        sx={{ 
                          backgroundColor: contentType === 'tv' ? 'rgba(66, 133, 244, 0.9)' : 'rgba(230, 81, 0, 0.9)',
                          color: 'white',
                          fontWeight: 'bold',
                          mb: 1,
                          backdropFilter: 'blur(3px)',
                          '& .MuiChip-label': {
                            px: 1
                          }
                        }}
                      />
                      
                      {/* Bewertungschip mit Emojis */}
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
                            '& .MuiChip-label': {
                              px: 1
                            }
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                  
                  <CardContent 
                    sx={{ 
                      position: 'relative',
                      zIndex: 2, 
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(5px)',
                      p: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography
                        className="movie-title"
                        variant="h6"
                        sx={{
                          fontWeight: 'bold',
                          maxWidth: 'calc(100% - 40px)',
                          wordBreak: 'break-word',
                          transition: 'all 0.3s ease',
                          background: 'linear-gradient(45deg, #00aeff, #a68eff)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        {item.title || item.name}
                      </Typography>
                      
                      {/* Animiertes Plus-Symbol */}
                      <IconButton
                        className="add-icon"
                        onClick={(e) => {
                          e.stopPropagation(); // Verhindert, dass das Modal geöffnet wird
                          handleAddToWatchlist(item);
                        }}
                        aria-label="zur Watchlist hinzufügen"
                        sx={{
                          opacity: 0,
                          transform: 'rotate(90deg) scale(0.8)',
                          transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
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
                    </Box>
                    
                    {/* Jahr */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'rgba(255, 255, 255, 0.9)',
                        mt: 1,
                        fontWeight: '500',
                        fontSize: '0.9rem'
                      }}
                    >
                      📅 {item.release_date ? new Date(item.release_date).getFullYear() : 
                         item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'Unbekannt'}
                    </Typography>
                    
                    {/* Serien-spezifische Infos */}
                    {contentType === 'tv' && (
                      <Box 
                        sx={{ 
                          mt: 1, 
                          pt: 1, 
                          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1
                        }}
                      >
                        {/* Staffelanzahl */}
                        {item.number_of_seasons > 0 && (
                          <Box 
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}
                          >
                            <Chip
                              size="small"
                              label={`${item.number_of_seasons} ${item.number_of_seasons === 1 ? 'Staffel' : 'Staffeln'}`}
                              sx={{
                                backgroundColor: 'rgba(66, 133, 244, 0.7)',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                              }}
                            />
                          </Box>
                        )}
                        
                        {/* Status */}
                        {item.status_de && (
                          <Box 
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}
                          >
                            <Chip
                              size="small"
                              icon={
                                item.status === 'Ended' ? 
                                  <span role="img" aria-label="abgeschlossen">✅</span> : 
                                item.in_production ? 
                                  <span role="img" aria-label="läuft">🎬</span> : 
                                  <span role="img" aria-label="status">📺</span>
                              }
                              label={item.status_de}
                              sx={{
                                backgroundColor: 
                                  item.status === 'Returning Series' ? 'rgba(76, 175, 80, 0.7)' : // laufend
                                  item.status === 'Ended' ? 'rgba(156, 39, 176, 0.7)' : // abgeschlossen
                                  item.status === 'Canceled' ? 'rgba(211, 47, 47, 0.7)' : // abgesetzt
                                  'rgba(255, 152, 0, 0.7)', // andere
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                animation: item.in_production ? 'pulse 2s infinite' : 'none',
                                '@keyframes pulse': {
                                  '0%': { opacity: 0.7 },
                                  '50%': { opacity: 1 },
                                  '100%': { opacity: 0.7 }
                                }
                              }}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Detail-Modal */}
          <Modal
            open={detailModalOpen}
            onClose={handleCloseDetail}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{
              timeout: 500,
              sx: { backdropFilter: 'blur(5px)' }
            }}
          >
            <Fade in={detailModalOpen}>
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: { xs: '95%', sm: '90%', md: '80%', lg: '70%' },
                maxHeight: '90vh',
                overflow: 'auto',
                bgcolor: 'rgba(14, 17, 23, 0.95)',
                borderRadius: '16px',
                boxShadow: 24,
                p: { xs: 2, sm: 4 },
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(136, 136, 136, 0.5)',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(136, 136, 136, 0.8)',
                }
              }}>
                {selectedItem && (
                  <>
                    {/* Schließen-Button */}
                    <IconButton 
                      onClick={handleCloseDetail}
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        color: 'white',
                        bgcolor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 10,
                        '&:hover': {
                          bgcolor: 'rgba(255, 0, 0, 0.7)',
                        }
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                    
                    {/* Backdrop als Hintergrund mit Farbverlauf-Overlay */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '40vh',
                        backgroundImage: selectedItem.backdrop_path 
                          ? `url(https://image.tmdb.org/t/p/original${selectedItem.backdrop_path})` 
                          : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'linear-gradient(0deg, rgba(14, 17, 23, 1) 0%, rgba(14, 17, 23, 0.7) 60%, rgba(14, 17, 23, 0.4) 100%)',
                        }
                      }}
                    />
                    
                    {/* Content-Container */}
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', md: 'row' },
                      position: 'relative',
                      zIndex: 2,
                      gap: 4,
                      pt: '10vh', 
                    }}>
                      {/* Poster */}
                      <Box sx={{ 
                        flexShrink: 0, 
                        width: { xs: '100%', sm: '300px' },
                        maxWidth: { xs: '70%', sm: '300px' },
                        alignSelf: { xs: 'center', md: 'flex-start' },
                        transform: { xs: 'translateY(-30px)', md: 'translateY(0)' },
                        position: 'relative',
                      }}>
                        <Box 
                          component="img"
                          src={selectedItem.poster_path 
                            ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}` 
                            : 'https://via.placeholder.com/300x450'}
                          alt={selectedItem.title || selectedItem.name}
                          sx={{
                            width: '100%',
                            height: 'auto',
                            objectFit: 'cover',
                            borderRadius: '12px',
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                            border: '2px solid rgba(255, 255, 255, 0.1)'
                          }}
                        />

                        {/* Bewertung als Overlay */}
                        {selectedItem.vote_average > 0 && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -15,
                              right: -15,
                              bgcolor: 
                                selectedItem.vote_average >= 8 ? 'rgba(116, 0, 184, 0.9)' : 
                                selectedItem.vote_average >= 7 ? 'rgba(0, 128, 128, 0.9)' : 
                                selectedItem.vote_average >= 6 ? 'rgba(255, 152, 0, 0.9)' : 
                                selectedItem.vote_average >= 5 ? 'rgba(66, 66, 66, 0.9)' : 
                                'rgba(211, 47, 47, 0.9)',
                              color: 'white',
                              p: 1,
                              borderRadius: '50%',
                              width: 60,
                              height: 60,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '1.2rem',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                              border: '2px solid rgba(255, 255, 255, 0.3)'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <StarIcon fontSize="small" />
                              <span>{Math.round(selectedItem.vote_average * 10) / 10}</span>
                            </Box>
                          </Box>
                        )}
                      </Box>
                      
                      {/* Info-Bereich */}
                      <Box sx={{ 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 2,
                      }}>
                        {/* Titel */}
                        <Typography 
                          variant="h4" 
                          sx={{ 
                            fontWeight: 'bold',
                            background: 'linear-gradient(45deg, #00aeff, #a68eff)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                          }}
                        >
                          {selectedItem.title || selectedItem.name}
                        </Typography>
                        
                        {/* Basic Info */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                          {/* Jahr */}
                          <Chip 
                            icon={<CalendarMonthIcon />}
                            label={selectedItem.release_date 
                              ? new Date(selectedItem.release_date).getFullYear() 
                              : selectedItem.first_air_date 
                                ? new Date(selectedItem.first_air_date).getFullYear() 
                                : 'Unbekannt'
                            }
                            size="small"
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
                          />
                          
                          {/* Medientyp */}
                          <Chip 
                            icon={contentType === 'tv' ? <TvIcon /> : <MovieIcon />}
                            label={contentType === 'tv' ? 'Serie' : 'Film'}
                            size="small"
                            sx={{ 
                              bgcolor: contentType === 'tv' 
                                ? 'rgba(66, 133, 244, 0.7)' 
                                : 'rgba(230, 81, 0, 0.7)', 
                              color: 'white' 
                            }}
                          />
                          
                          {/* Staffeln bei Serien */}
                          {contentType === 'tv' && selectedItem.number_of_seasons > 0 && (
                            <Chip
                              label={`${selectedItem.number_of_seasons} ${selectedItem.number_of_seasons === 1 ? 'Staffel' : 'Staffeln'}`}
                              size="small"
                              sx={{ bgcolor: 'rgba(103, 58, 183, 0.7)', color: 'white' }}
                            />
                          )}
                          
                          {/* Status bei Serien */}
                          {contentType === 'tv' && selectedItem.status_de && (
                            <Chip
                              label={selectedItem.status_de}
                              size="small"
                              sx={{
                                bgcolor: 
                                  selectedItem.status === 'Returning Series' ? 'rgba(76, 175, 80, 0.7)' : // laufend
                                  selectedItem.status === 'Ended' ? 'rgba(156, 39, 176, 0.7)' : // abgeschlossen
                                  selectedItem.status === 'Canceled' ? 'rgba(211, 47, 47, 0.7)' : // abgesetzt
                                  'rgba(255, 152, 0, 0.7)', // andere
                                color: 'white',
                                animation: selectedItem.in_production ? 'pulse 2s infinite' : 'none',
                                '@keyframes pulse': {
                                  '0%': { opacity: 0.7 },
                                  '50%': { opacity: 1 },
                                  '100%': { opacity: 0.7 }
                                }
                              }}
                            />
                          )}
                          
                          {/* Zur Watchlist Button */}
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => handleAddToWatchlist(selectedItem)}
                            sx={{
                              ml: 'auto',
                              bgcolor: 'rgba(255, 215, 0, 0.8)',
                              color: 'black',
                              fontWeight: 'bold',
                              '&:hover': {
                                bgcolor: 'rgba(255, 215, 0, 1)',
                              }
                            }}
                          >
                            Zur Watchlist
                          </Button>
                        </Box>
                        
                        {/* Übersicht/Handlung */}
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="h6" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                            Handlung
                          </Typography>
                          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            {selectedItem.overview || 'Keine Beschreibung verfügbar.'}
                          </Typography>
                        </Box>
                        
                        {/* Serien-spezifische Infos */}
                        {contentType === 'tv' && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                              Seriendetails
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', gap: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                                  Status:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                                  {selectedItem.status_de || 'Unbekannt'}
                                  {selectedItem.in_production && ' (In Produktion)'}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                                  Staffeln:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                                  {selectedItem.number_of_seasons || 'Unbekannt'}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                                  Erstausstrahlung:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                                  {selectedItem.first_air_date 
                                    ? new Date(selectedItem.first_air_date).toLocaleDateString('de-DE', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                      })
                                    : 'Unbekannt'
                                  }
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        )}
                        
                        {/* Film-spezifische Infos */}
                        {contentType === 'movie' && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                              Filmdetails
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', gap: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                                  Erscheinungsdatum:
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                                  {selectedItem.release_date 
                                    ? new Date(selectedItem.release_date).toLocaleDateString('de-DE', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                      })
                                    : 'Unbekannt'
                                  }
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
            </Fade>
          </Modal>
          
          {/* keine Ergebnisse */}
          {content.length === 0 && !loading && !error && (
            <Box sx={{ textAlign: 'center', mt: 6, mb: 6 }}>
              <Typography
                variant="h6"
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  mb: 2
                }}
              >
                Keine Ergebnisse gefunden
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                Versuchen Sie einen anderen Suchbegriff oder ändern Sie die Filter.
              </Typography>
              <Button
                variant="outlined"
                onClick={loadContent}
                sx={{ 
                  mt: 3,
                  color: '#00ff9d',
                  borderColor: '#00ff9d',
                  '&:hover': {
                    borderColor: '#00cc7d',
                    backgroundColor: 'rgba(0, 255, 157, 0.1)'
                  }
                }}
              >
                Neu laden
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Discover; 