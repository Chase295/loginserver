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
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';

const SearchComponent = ({ onAddMovie }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedType, setSelectedType] = useState('movie');
  const [status, setStatus] = useState('watchlist');
  const [abbruchGrund, setAbbruchGrund] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [tagColor, setTagColor] = useState('#2196f3');
  const [allTags, setAllTags] = useState(() => JSON.parse(localStorage.getItem('allTags') || '[]'));

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

  const handleAddTag = (tag) => {
    if (!tags.some(t => t.label === tag.label)) {
      setTags([...tags, tag]);
      if (!allTags.some(t => t.label === tag.label)) {
        const updated = [...allTags, tag];
        setAllTags(updated);
        localStorage.setItem('allTags', JSON.stringify(updated));
      }
    }
  };

  const handleAddMovie = (movie) => {
    // Bereite Tags richtig vor (nur primitive Werte)
    const cleanTags = tags.map(tag => ({
      label: String(tag.label || ''),
      color: String(tag.color || '#000000')
    }));
    
    const movieData = {
      title: movie.title || movie.name,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      tmdb_id: movie.id.toString(),
      media_type: movie.media_type || selectedType,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average,
      genres: movie.genres || [],
      status,
      abbruch_grund: status === 'abgebrochen' ? abbruchGrund : undefined,
      rating: rating || 0,
      notes: notes || '',
      tags: cleanTags,
      release_date: movie.release_date,
      first_air_date: movie.first_air_date,
      number_of_seasons: movie.number_of_seasons,
      status_de: movie.status_de
    };
    
    // Entferne undefined oder null Werte
    Object.keys(movieData).forEach(key => {
      if (movieData[key] === undefined || movieData[key] === null) {
        delete movieData[key];
      }
    });
    
    // Debug-Log
    console.log('Sending movie data:', JSON.stringify(movieData));
    
    onAddMovie(movieData);
    
    // Felder zurücksetzen nach dem Hinzufügen
    setStatus('watchlist');
    setRating(0);
    setNotes('');
    setTags([]);
    setAbbruchGrund('');
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

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
        {/* Status-Auswahl */}
        <Box>
          <Typography variant="subtitle1">Status</Typography>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: 8, borderRadius: 6 }}>
            <option value="watchlist">Watchlist</option>
            <option value="gesehen">Gesehen</option>
            <option value="am_schauen">Am Schauen</option>
            <option value="abgebrochen">Abgebrochen</option>
          </select>
        </Box>
        {/* Abbruchgrund nur wenn abgebrochen */}
        {status === 'abgebrochen' && (
          <TextField label="Abbruch-Grund" value={abbruchGrund} onChange={e => setAbbruchGrund(e.target.value)} fullWidth />
        )}
        {/* Bewertung */}
        <Box>
          <Typography variant="subtitle1">Bewertung</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {[...Array(10)].map((_, i) => (
              <span key={i} style={{ cursor: 'pointer', color: i < rating ? '#FFD700' : '#ccc', fontSize: 24 }} onClick={() => setRating(i+1)}>&#9733;</span>
            ))}
            <Typography sx={{ ml: 1 }}>{rating}/10</Typography>
          </Box>
        </Box>
        {/* Notizen */}
        <TextField label="Notizen" value={notes} onChange={e => setNotes(e.target.value)} fullWidth multiline minRows={2} />
        {/* Tags */}
        <Box>
          <Typography variant="subtitle1">Tags</Typography>
          <Autocomplete
            multiple
            freeSolo
            options={allTags}
            getOptionLabel={option => option.label || ''}
            value={tags}
            onChange={(e, newValue) => setTags(newValue)}
            onInputChange={(e, value) => setTagInput(value)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  style={{ backgroundColor: option.color, color: '#fff', marginRight: 4 }}
                  {...getTagProps({ index })}
                />
              ))
            }
            renderInput={params => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} ref={params.InputProps.ref}>
                <input type="color" value={tagColor} onChange={e => setTagColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', background: 'none' }} />
                <TextField {...params} variant="outlined" placeholder="Tag hinzufügen..." size="small" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput) {
                    handleAddTag({ label: tagInput, color: tagColor });
                    setTagInput('');
                    e.preventDefault();
                  }
                }} />
              </Box>
            )}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default SearchComponent; 