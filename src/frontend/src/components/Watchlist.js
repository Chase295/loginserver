import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
  CircularProgress,
  Grid,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchComponent from './watchlist/SearchComponent';
import MovieCard from './watchlist/MovieCard';
import SettingsIcon from '@mui/icons-material/Settings';
import ExploreIcon from '@mui/icons-material/Explore';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';

const Watchlist = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movies, setMovies] = useState([]);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);

  const fetchMovies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/watchlist/movies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Filme');
      }

      const data = await response.json();
      setMovies(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const initializeWatchlist = async () => {
      try {
        // Watchlist erstellen oder abrufen
        const response = await fetch('http://localhost:8000/api/watchlist', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Fehler beim Erstellen der Watchlist');
        }

        // Filme laden
        await fetchMovies();
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    initializeWatchlist();
  }, [navigate]);

  const handleAddMovie = async (movie) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/watchlist/movies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(movie)
      });

      if (!response.ok) {
        throw new Error('Fehler beim Hinzufügen des Films');
      }

      const newMovie = await response.json();
      setMovies(prevMovies => [...prevMovies, newMovie]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMovie = async (movieId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/watchlist/movies/${movieId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen des Films');
      }

      setMovies(prevMovies => prevMovies.filter(movie => movie.id !== movieId));
    } catch (err) {
      setError(err.message);
    }
  };

  // Einstellungsmenü öffnen/schließen
  const handleSettingsClick = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
  };

  // Präferenzen für Entdecken-Seite speichern
  const handleSetPreference = (type, value) => {
    localStorage.setItem(`preferred${type}`, value);
    handleSettingsClose();
  };

  if (loading) {
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
        background: 'linear-gradient(45deg, #0a1929 30%, #1a2027 90%)',
        py: 4
      }}
    >
      <Container maxWidth="lg">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/dashboard')}
          sx={{
            color: '#00ff9d',
            mb: 4,
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 157, 0.1)'
            }
          }}
        >
          Zurück zum Dashboard
        </Button>

        <SearchComponent onAddMovie={handleAddMovie} />

        <Paper
          elevation={3}
          sx={{
            p: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                color: '#00ff9d',
                mb: 0
              }}
            >
              Meine Watchlist 📺
            </Typography>
            <Box>
              <IconButton
                onClick={handleSettingsClick}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  mr: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#00ff9d'
                  }
                }}
              >
                <SettingsIcon />
              </IconButton>
              <Button
                variant="outlined"
                startIcon={<ExploreIcon />}
                onClick={() => navigate('/discover')}
                sx={{
                  color: '#00ff9d',
                  borderColor: '#00ff9d',
                  '&:hover': {
                    borderColor: '#00cc7d',
                    backgroundColor: 'rgba(0, 255, 157, 0.1)'
                  }
                }}
              >
                Entdecken
              </Button>
            </Box>
          </Box>

          {error ? (
            <Typography color="error" align="center">
              {error}
            </Typography>
          ) : movies.length === 0 ? (
            <Typography
              variant="body1"
              sx={{
                color: 'white',
                textAlign: 'center'
              }}
            >
              Ihre Watchlist ist noch leer. Suchen Sie nach Filmen oder Serien, um sie hinzuzufügen.
            </Typography>
          ) : (
            <Grid container spacing={3}>
              {movies.map((movie) => (
                <Grid item xs={12} sm={6} md={4} key={movie.id}>
                  <MovieCard
                    movie={movie}
                    onDelete={handleDeleteMovie}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Einstellungsmenü */}
        <Menu
          anchorEl={settingsAnchorEl}
          open={Boolean(settingsAnchorEl)}
          onClose={handleSettingsClose}
          PaperProps={{
            sx: {
              bgcolor: '#1a2027',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              '& .MuiMenuItem-root:hover': {
                bgcolor: 'rgba(0, 255, 157, 0.1)'
              }
            }
          }}
        >
          <Typography sx={{ px: 2, py: 1, opacity: 0.7 }}>
            Entdecken: Inhaltstyp
          </Typography>
          <MenuItem onClick={() => handleSetPreference('ContentType', 'movie')}>
            <ListItemIcon>
              <MovieIcon sx={{ color: localStorage.getItem('preferredContentType') === 'movie' ? '#00ff9d' : 'white' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Filme" 
              primaryTypographyProps={{ 
                color: localStorage.getItem('preferredContentType') === 'movie' ? '#00ff9d' : 'white'
              }} 
            />
          </MenuItem>
          <MenuItem onClick={() => handleSetPreference('ContentType', 'tv')}>
            <ListItemIcon>
              <TvIcon sx={{ color: localStorage.getItem('preferredContentType') === 'tv' ? '#00ff9d' : 'white' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Serien" 
              primaryTypographyProps={{ 
                color: localStorage.getItem('preferredContentType') === 'tv' ? '#00ff9d' : 'white'
              }} 
            />
          </MenuItem>
          <Typography sx={{ px: 2, py: 1, mt: 1, opacity: 0.7 }}>
            Entdecken: Anzeigemodus
          </Typography>
          <MenuItem onClick={() => handleSetPreference('DisplayMode', 'trending')}>
            <ListItemIcon>
              <TrendingUpIcon sx={{ color: localStorage.getItem('preferredDisplayMode') === 'trending' ? '#00ff9d' : 'white' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Trending" 
              primaryTypographyProps={{ 
                color: localStorage.getItem('preferredDisplayMode') === 'trending' ? '#00ff9d' : 'white'
              }} 
            />
          </MenuItem>
          <MenuItem onClick={() => handleSetPreference('DisplayMode', 'upcoming')}>
            <ListItemIcon>
              <NewReleasesIcon sx={{ color: localStorage.getItem('preferredDisplayMode') === 'upcoming' ? '#00ff9d' : 'white' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Neu & Kommend" 
              primaryTypographyProps={{ 
                color: localStorage.getItem('preferredDisplayMode') === 'upcoming' ? '#00ff9d' : 'white'
              }} 
            />
          </MenuItem>
        </Menu>
      </Container>
    </Box>
  );
};

export default Watchlist; 