import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';

const SearchComponent = ({ onAddMovie }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedType, setSelectedType] = useState('movie');

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}&type=${selectedType}`);
      const data = await response.json();
      
      if (data.results) {
        setResults(data.results);
      } else {
        setError('Keine Ergebnisse gefunden');
      }
    } catch (err) {
      setError('Fehler bei der Suche. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMovie = (movie) => {
    const movieData = {
      title: movie.title || movie.name,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      tmdb_id: movie.id.toString(),
      media_type: movie.media_type || selectedType,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average
    };
    
    // Sicherstellen, dass keine undefined oder null Werte bleiben
    Object.keys(movieData).forEach(key => {
      if (movieData[key] === undefined || movieData[key] === null) {
        delete movieData[key];
      }
    });
    
    onAddMovie(movieData);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: 2,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        mb: 4
      }}
    >
      <Typography
        variant="h6"
        sx={{
          color: '#00ff9d',
          mb: 2
        }}
      >
        Film oder Serie suchen 🔍
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Titel eingeben..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: 'white',
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.23)',
              },
              '&:hover fieldset': {
                borderColor: '#00ff9d',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#00ff9d',
              },
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={loading || !searchTerm.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
          sx={{
            backgroundColor: '#00ff9d',
            color: '#0a1929',
            '&:hover': {
              backgroundColor: '#00cc7d'
            },
            '&:disabled': {
              backgroundColor: 'rgba(0, 255, 157, 0.5)'
            }
          }}
        >
          Suchen
        </Button>
      </Box>

      {error && (
        <Typography
          color="error"
          sx={{ mt: 2 }}
        >
          {error}
        </Typography>
      )}

      {results.length > 0 && (
        <Grid container spacing={2}>
          {results.map((movie) => (
            <Grid item xs={12} sm={6} md={4} key={movie.id}>
              <Card
                sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'scale(1.02)',
                    boxShadow: '0 0 20px rgba(0, 255, 157, 0.2)'
                  }
                }}
              >
                <CardMedia
                  component="img"
                  height="200"
                  image={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/345x200'}
                  alt={movie.title || movie.name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography
                      variant="h6"
                      sx={{
                        color: '#00ff9d',
                        fontWeight: 'bold'
                      }}
                    >
                      {movie.title || movie.name}
                    </Typography>
                    <IconButton
                      onClick={() => handleAddMovie(movie)}
                      sx={{
                        color: '#00ff9d',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 255, 157, 0.1)'
                        }
                      }}
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      mt: 1
                    }}
                  >
                    {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Paper>
  );
};

export default SearchComponent; 