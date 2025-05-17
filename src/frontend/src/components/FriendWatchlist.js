import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Container, 
  Paper, 
  Button, 
  Grid, 
  TextField,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Tab,
  Tabs,
  Alert
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import MediaCard from './MediaCard';
import WatchlistDetail from './watchlist/WatchlistDetail';

const FriendWatchlist = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [filteredMovies, setFilteredMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Status-Optionen
  const statusOptions = [
    { value: 'all', label: 'Alle' },
    { value: 'plan_to_watch', label: 'Geplant' },
    { value: 'watching', label: 'Am Schauen' },
    { value: 'completed', label: 'Abgeschlossen' },
    { value: 'dropped', label: 'Abgebrochen' }
  ];

  // Tags des Freundes laden
  useEffect(() => {
    const fetchFriendTags = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:8000/api/user/${username}/tags`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableTags(data);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Tags:', err);
      }
    };
    fetchFriendTags();
  }, [username]);

  // Watchlist laden
  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetchFriendWatchlist = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Nicht eingeloggt');
          setLoading(false);
          return;
        }

        const res = await fetch(`http://localhost:8000/api/watchlist/user/${username}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 404) {
          setError(`Die Watchlist von ${username} wurde nicht gefunden oder ist nicht öffentlich zugänglich.`);
          setMovies([]);
        } else if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        } else {
          const data = await res.json();
          setMovies(data);
          setFilteredMovies(data);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Watchlist:', err);
        setError('Ein Fehler ist aufgetreten beim Laden der Watchlist.');
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFriendWatchlist();
  }, [username]);

  // Filter anwenden
  useEffect(() => {
    let filtered = [...movies];
    // Suchfilter (wie Watchlist: Titel oder Name)
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(movie =>
        (movie.title && movie.title.toLowerCase().includes(query)) ||
        (movie.name && movie.name.toLowerCase().includes(query))
      );
    }
    // Statusfilter (Mehrfachauswahl)
    if (filterStatus.length > 0) {
      filtered = filtered.filter(movie => filterStatus.includes(movie.status));
    }
    // Tagfilter (mind. einer der ausgewählten Tags muss enthalten sein)
    if (filterTags.length > 0) {
      filtered = filtered.filter(movie => {
        const movieTags = Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []);
        return filterTags.every(fTag => movieTags.some(tag => tag.label === fTag.label && tag.color === fTag.color));
      });
    }
    setFilteredMovies(filtered);
  }, [movies, searchTerm, filterStatus, filterTags]);

  const handleFilterOpen = () => setFilterOpen(true);
  const handleFilterClose = () => setFilterOpen(false);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus([]);
    setFilterTags([]);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)', py: 4 }}>
      <Container maxWidth="lg">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ color: '#00ff9d', mb: 4, '&:hover': { backgroundColor: 'rgba(0, 255, 157, 0.1)' } }}
        >
          Zurück
        </Button>
        <Paper elevation={3} sx={{ p: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, mb: 4 }}>
          <Typography variant="h4" sx={{ color: '#00ff9d', mb: 3, textAlign: 'center' }}>
            {username}'s Watchlist
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Suchleiste und Filter-Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
            <TextField
              variant="outlined"
              placeholder="Titel suchen..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 260, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}
              onKeyDown={e => { if (e.key === 'Enter') {/* optional: fetchFriendWatchlist(); */} }}
            />
            <Button
              variant="contained"
              sx={{
                bgcolor: '#00ff9d',
                color: '#0a1929',
                fontWeight: 'bold',
                borderRadius: 2,
                px: 3,
                boxShadow: '0 2px 8px #00ff9d33',
                '&:hover': { bgcolor: '#00cc7d' }
              }}
              startIcon={<SearchIcon />}
              onClick={() => { /* optional: fetchFriendWatchlist(); */ }}
            >
              Suchen
            </Button>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setFilterOpen(true)}
              sx={{
                color: '#00ff9d',
                borderColor: '#00ff9d',
                borderRadius: 2,
                fontWeight: 'bold',
                px: 2,
                '&:hover': { borderColor: '#00cc7d', background: 'rgba(0,255,157,0.08)' }
              }}
            >
              Filter
            </Button>
          </Box>

          {/* Aktive Filter anzeigen */}
          {(filterStatus.length > 0 || filterTags.length > 0) && (
            <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {filterStatus.map(stat => (
                <Chip
                  key={stat}
                  label={`Status: ${stat}`}
                  onDelete={() => setFilterStatus(filterStatus.filter(s => s !== stat))}
                  sx={{ backgroundColor: 'rgba(0, 255, 157, 0.1)', color: '#00ff9d' }}
                />
              ))}
              {filterTags.map((tag, idx) => (
                <Chip
                  key={tag.label + tag.color + idx}
                  label={tag.label}
                  onDelete={() => setFilterTags(filterTags.filter((t, i) => i !== idx))}
                  sx={{ backgroundColor: tag.color || 'rgba(0, 255, 157, 0.1)', color: '#fff' }}
                />
              ))}
              <Button size="small" onClick={() => { setFilterStatus([]); setFilterTags([]); }} sx={{ color: '#00ff9d' }}>
                Filter zurücksetzen
              </Button>
            </Box>
          )}

          {loading ? (
            <Typography sx={{ color: '#fff', textAlign: 'center' }}>Lade Watchlist...</Typography>
          ) : !error && filteredMovies.length === 0 ? (
            <Typography sx={{ color: '#fff', textAlign: 'center' }}>
              {movies.length === 0 ? 'Keine Einträge sichtbar.' : 'Keine Einträge entsprechen den Filtern.'}
            </Typography>
          ) : !error && (
            <Grid container spacing={3}>
              {filteredMovies.map(movie => {
                const mediaType = movie.media_type || 'movie';
                return (
                <Grid item xs={12} sm={6} md={4} key={movie.id}>
                  <MediaCard
                    item={{
                      ...movie,
                        media_type: mediaType,
                        poster_url: movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://placehold.co/300x450/1a2027/ffffff?text=Kein+Bild'),
                        release_date: movie.year ? `${movie.year}-01-01` : null,
                        first_air_date: movie.year && mediaType === 'tv' ? `${movie.year}-01-01` : null,
                        number_of_seasons: movie.number_of_seasons,
                        number_of_episodes: movie.number_of_episodes,
                        status_de: mediaType === 'tv' && movie.status_de ? movie.status_de : undefined
                    }}
                    userData={{
                      status: movie.status,
                      rating: movie.rating,
                      tags: movie.tags,
                      notes: movie.notes,
                      abbruch_grund: movie.abbruch_grund
                    }}
                    showAddButton={false}
                    onAdd={null}
                    onDelete={null}
                      onClick={() => { setSelectedItem(movie); setDetailModalOpen(true); }}
                  />
                </Grid>
                );
              })}
            </Grid>
          )}
        </Paper>

        {/* Filter-Dialog */}
        <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Filter</DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Status</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {[
                  { key: 'plan_to_watch', label: 'Geplant' },
                  { key: 'watching', label: 'Am Schauen' },
                  { key: 'completed', label: 'Abgeschlossen' },
                  { key: 'dropped', label: 'Abgebrochen' }
                ].map(stat => (
                  <Box
                    key={stat.key}
                    onClick={() => setFilterStatus(prev => prev.includes(stat.key) ? prev.filter(s => s !== stat.key) : [...prev, stat.key])}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      borderRadius: 999,
                      fontWeight: 600,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      background: filterStatus.includes(stat.key)
                        ? (stat.key === 'completed' ? 'rgba(0,255,157,0.13)' :
                          stat.key === 'watching' ? 'rgba(0,183,255,0.13)' :
                          stat.key === 'dropped' ? 'rgba(255,0,98,0.13)' :
                          'rgba(255,255,255,0.10)')
                        : 'rgba(255,255,255,0.05)',
                      color: filterStatus.includes(stat.key)
                        ? (stat.key === 'completed' ? '#00ff9d' :
                          stat.key === 'watching' ? '#00b7ff' :
                          stat.key === 'dropped' ? '#ff0062' :
                          '#fff')
                        : '#bbb',
                      border: filterStatus.includes(stat.key)
                        ? `2px solid ${
                            stat.key === 'completed' ? '#00ff9d' :
                            stat.key === 'watching' ? '#00b7ff' :
                            stat.key === 'dropped' ? '#ff0062' :
                            '#fff'
                          }` : '2px solid rgba(255,255,255,0.10)',
                      boxShadow: filterStatus.includes(stat.key)
                        ? `0 0 12px 2px ${
                            stat.key === 'completed' ? '#00ff9d33' :
                            stat.key === 'watching' ? '#00b7ff33' :
                            stat.key === 'dropped' ? '#ff006233' :
                            '#fff3'
                          }` : 'none',
                      transition: 'all 0.2s',
                      '&:hover': {
                        background: 'rgba(0,255,157,0.08)',
                        color: '#00ff9d',
                        borderColor: '#00ff9d',
                      }
                    }}
                  >
                    <span>{stat.label}</span>
                  </Box>
                ))}
              </Box>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Tags</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {availableTags.map((tag, idx) => (
                  <Chip
                    key={tag.label + tag.color + idx}
                    label={tag.label}
                    icon={<Box sx={{ background: tag.color, borderRadius: '50%', width: 14, height: 14, display: 'inline-block', marginRight: 4 }} />}
                    onClick={() => setFilterTags(prev => prev.some(t => t.label === tag.label && t.color === tag.color) ? prev.filter(t => !(t.label === tag.label && t.color === tag.color)) : [...prev, tag])}
                    sx={{
                      bgcolor: filterTags.some(t => t.label === tag.label && t.color === tag.color) ? tag.color + '22' : 'rgba(20,20,35,0.3)',
                      color: filterTags.some(t => t.label === tag.label && t.color === tag.color) ? '#fff' : tag.color,
                      fontWeight: 'bold',
                      borderRadius: 50,
                      px: 1.5,
                      mb: 0.5,
                      border: filterTags.some(t => t.label === tag.label && t.color === tag.color) ? `2.5px solid ${tag.color}` : `1px solid ${tag.color}55`,
                      boxShadow: filterTags.some(t => t.label === tag.label && t.color === tag.color) ? `0 0 12px 2px ${tag.color}55` : `0 2px 8px 0 ${tag.color}22`,
                      mr: 0.5,
                      fontSize: '0.9rem',
                      textShadow: filterTags.some(t => t.label === tag.label && t.color === tag.color) ? `0 0 8px #fff` : `0 0 6px ${tag.color}99`,
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: filterTags.some(t => t.label === tag.label && t.color === tag.color) ? tag.color + '33' : 'rgba(40,40,55,0.9)',
                        opacity: 1
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setFilterStatus([]); setFilterTags([]); }} color="secondary">Zurücksetzen</Button>
            <Button onClick={() => setFilterOpen(false)} variant="contained" sx={{ bgcolor: '#00ff9d', color: '#0a1929', fontWeight: 'bold', borderRadius: 2, px: 3, boxShadow: '0 2px 8px #00ff9d33', '&:hover': { bgcolor: '#00cc7d' } }}>Filter anwenden</Button>
          </DialogActions>
        </Dialog>

        <WatchlistDetail
          detailModalOpen={detailModalOpen}
          handleCloseDetail={() => setDetailModalOpen(false)}
          selectedItem={selectedItem}
          status={selectedItem?.status}
          setStatus={() => {}}
          abbruchGrund={selectedItem?.abbruch_grund}
          setAbbruchGrund={() => {}}
          rating={selectedItem?.rating}
          setRating={() => {}}
          notes={selectedItem?.notes}
          setNotes={() => {}}
          tags={selectedItem?.tags}
          setTags={() => {}}
          tagInput={''}
          setTagInput={() => {}}
          tagColor={'#2196f3'}
          setTagColor={() => {}}
          allTags={[]}
          handleAddTag={() => {}}
          handleSaveDetail={() => {}}
          isPrivate={selectedItem?.is_private}
          setIsPrivate={() => {}}
          readOnly={true}
        />
      </Container>
    </Box>
  );
};

export default FriendWatchlist; 