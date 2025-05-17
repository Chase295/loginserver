import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Modal,
  Fade,
  TextField,
  Chip,
  Checkbox,
  FormControlLabel,
  Switch
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchComponent from './watchlist/SearchComponent';
import SettingsIcon from '@mui/icons-material/Settings';
import ExploreIcon from '@mui/icons-material/Explore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import WatchlistCard from './watchlist/WatchlistCard';
import CloseIcon from '@mui/icons-material/Close';
import Rating from '@mui/material/Rating';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import StarIcon from '@mui/icons-material/Star';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import FilterListIcon from '@mui/icons-material/FilterList';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormGroup from '@mui/material/FormGroup';
import SearchIcon from '@mui/icons-material/Search';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormLabel from '@mui/material/FormLabel';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Autocomplete from '@mui/material/Autocomplete';
import GroupIcon from '@mui/icons-material/Group';
import WatchlistHeader from './watchlist/WatchlistHeader';
import WatchlistDetail from './watchlist/WatchlistDetail';
import WatchlistFilter from './watchlist/WatchlistFilter';
import WatchlistSettings from './watchlist/WatchlistSettings';
import MultiplayerDialog from './watchlist/MultiplayerDialog';
import MediaCard from './MediaCard';

const Watchlist = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movies, setMovies] = useState([]);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [status, setStatus] = useState('watchlist');
  const [abbruchGrund, setAbbruchGrund] = useState('');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [tagColor, setTagColor] = useState('#2196f3');
  const [allTags, setAllTags] = useState(() => JSON.parse(localStorage.getItem('allTags') || '[]'));
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState('friends');
  const [settingsTab, setSettingsTab] = useState(0);
  const [privateTags, setPrivateTags] = useState([]);
  const [privateTitles, setPrivateTitles] = useState([]);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [friendsWithWatchlist, setFriendsWithWatchlist] = useState([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showPrivateOnly, setShowPrivateOnly] = useState(false);
  const [privacyFilter, setPrivacyFilter] = useState('all'); // 'all', 'private', 'public'

  const username = localStorage.getItem('username');

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
      
      // Bei Serien zusätzliche Details laden
      const moviesWithDetails = await Promise.all(
        data.map(async (movie) => {
          // Stellen Sie sicher, dass media_type gesetzt ist
          const mediaType = movie.media_type || 'movie';
          
          if (mediaType === 'tv' && movie.tmdb_id) {
            try {
              const detailsResponse = await fetch(`http://localhost:8000/api/tv/${movie.tmdb_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                console.log('Serie details:', details);
                return {
                  ...movie,
                  media_type: 'tv',  // Stelle sicher, dass es explizit gesetzt ist
                  number_of_seasons: details.number_of_seasons,
                  number_of_episodes: details.number_of_episodes,
                  series_status: details.status,
                  first_air_date: details.first_air_date,
                  status_de: details.status === 'Returning Series' ? 'Laufend' :
                            details.status === 'Ended' ? 'Abgeschlossen' :
                            details.status === 'Canceled' ? 'Abgebrochen' :
                            details.status === 'In Production' ? 'In Produktion' :
                            details.status
                };
              }
            } catch (error) {
              console.error('Fehler beim Laden der Serien-Details:', error);
            }
          }
          return {
            ...movie,
            media_type: mediaType // Stelle sicher, dass es immer gesetzt ist
          };
        })
      );
      
      console.log('Filme/Serien mit Details:', moviesWithDetails);
      setMovies(moviesWithDetails);
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
        await fetch('http://localhost:8000/api/watchlist', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        await fetchMovies();
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    initializeWatchlist();
  }, [navigate]);

  const handleSettingsClick = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };
  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
  };
  const handleSetPreference = (type, value) => {
    localStorage.setItem(`preferred${type}`, value);
    handleSettingsClose();
  };

  const handleDeleteMovie = async (movie) => {
    try {
      const token = localStorage.getItem('token');
      // API-Request zum Löschen
      const response = await fetch(`http://localhost:8000/api/watchlist/movies/${movie.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Fehler beim Löschen des Titels');
      }
      // Nach dem Löschen Watchlist neu laden
      await fetchMovies();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOpenDetail = (item) => {
    console.log('Öffne Details für:', item);
    setSelectedItem(item);
    setDetailModalOpen(true);
    setStatus(item.status || 'watchlist');
    setRating(item.rating ? Number(item.rating) : 0);
    setNotes(item.notes || '');
    setTags(Array.isArray(item.tags) ? item.tags : (item.tags ? JSON.parse(item.tags) : []));
    setAbbruchGrund(item.abbruch_grund || '');
    setTagInput('');
    setTagColor('#2196f3');
    setIsEdit(true);
    setEditId(item.id);
    setIsPrivate(item.is_private === true);
    fetchUserTags();
  };
  const handleCloseDetail = () => {
    setDetailModalOpen(false);
  };
  const handleSaveDetail = async () => {
    try {
      setError(null);
      setSuccess(null);
      const token = localStorage.getItem('token');
      console.log('Speichere Rating:', rating, 'Typ:', typeof rating);
      
      const cleanTags = tags.map(tag => ({
        label: String(tag.label || ''),
        color: String(tag.color || '#000000'),
        is_private: !!tag.is_private
      }));
      
      const movieData = {
        title: selectedItem.title || selectedItem.name || '',
        year: selectedItem.year,
        poster_url: selectedItem.poster_url,
        tmdb_id: selectedItem.tmdb_id,
        media_type: selectedItem.media_type,
        backdrop_path: selectedItem.backdrop_path,
        overview: selectedItem.overview,
        vote_average: selectedItem.vote_average,
        genres: selectedItem.genres,
        status,
        abbruch_grund: status === 'abgebrochen' ? abbruchGrund : undefined,
        rating: Number(rating),
        notes: notes || '',
        tags: cleanTags,
        is_private: isPrivate === true
      };
      
      // Debug-Log für Rating
      console.log('Rating vor dem Senden:', movieData.rating, 'Typ:', typeof movieData.rating);
      
      const safeData = JSON.parse(JSON.stringify(movieData));
      console.log('Speichere Daten:', safeData);
      
      const response = await fetch(`http://localhost:8000/api/watchlist/movies/${editId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(safeData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fehler beim Speichern der Änderungen');
      }
      
      const responseData = await response.json();
      console.log('Server Antwort:', responseData);
      
      setSuccess(`"${selectedItem.title || selectedItem.name}" wurde aktualisiert.`);
      setTimeout(() => { setSuccess(null); }, 3000);
      setDetailModalOpen(false);
      await fetchMovies();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError(err.message);
      setTimeout(() => { setError(null); }, 3000);
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

  // Lade User-Tags aus dem Backend
  const fetchUserTags = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('http://localhost:8000/api/user/tags', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const tags = await response.json();
        setAllTags(tags);
        localStorage.setItem('allTags', JSON.stringify(tags));
      }
    } catch (e) {
      // Fehler ignorieren, falls offline
    }
  };

  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      // Status Filter
      if (filterStatus.length > 0) {
        const hasMatchingStatus = filterStatus.some(status => movie.status === status);
        if (!hasMatchingStatus) return false;
      }

      // Tags Filter
      if (filterTags.length > 0) {
        const hasMatchingTag = filterTags.some(filterTag => {
          const movieTags = Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []);
          return movieTags.some(tag => tag.label === filterTag.label);
        });
        if (!hasMatchingTag) return false;
      }

      // Privacy Filter
      const isPrivate = movie.is_private || (Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []))
        .some(tag => tag.label.toLowerCase().includes('privat') || tag.label.toLowerCase().includes('lw'));
      
      switch (privacyFilter) {
        case 'private':
          if (!isPrivate) return false;
          break;
        case 'public':
          if (isPrivate) return false;
          break;
        case 'all':
        default:
          break;
      }

      return true;
    });
  }, [movies, filterStatus, filterTags, privacyFilter]);

  // Multiplayer-Modal öffnen: Freunde laden
  const handleOpenMultiplayer = async () => {
    setMultiplayerOpen(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8000/api/friends/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFriendsWithWatchlist(data);
      } else {
        setFriendsWithWatchlist([]);
      }
    } catch {
      setFriendsWithWatchlist([]);
    }
  };

  // Neue Funktion zum Laden der privaten Tags
  const loadPrivateTags = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/watchlist/movies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const allMovies = await response.json();
        const privateTags = new Set();
        
        // Sammle alle privaten Tags aus allen Filmen
        allMovies.forEach(movie => {
          const movieTags = Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []);
          movieTags.forEach(tag => {
            if (tag.is_private) {
              privateTags.add(JSON.stringify({ label: tag.label, color: tag.color }));
            }
          });
        });

        // Konvertiere Set zurück zu Array und parse die JSON-Strings
        const uniquePrivateTags = Array.from(privateTags).map(tagString => JSON.parse(tagString));
        setPrivateTags(uniquePrivateTags);
        
        // Aktualisiere auch die allTags Liste
        const allTagsSet = new Set([...allTags.map(tag => JSON.stringify(tag))]);
        uniquePrivateTags.forEach(tag => allTagsSet.add(JSON.stringify(tag)));
        const updatedAllTags = Array.from(allTagsSet).map(tagString => JSON.parse(tagString));
        setAllTags(updatedAllTags);
        localStorage.setItem('allTags', JSON.stringify(updatedAllTags));
      }
    } catch (err) {
      console.error('Fehler beim Laden der privaten Tags:', err);
    }
  };

  // Neue Funktion zum Laden der Watchlist-Einstellungen
  const loadWatchlistSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('Kein Token gefunden');
        return;
      }
      const res = await fetch('http://localhost:8000/api/watchlist/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const settings = await res.json();
        setProfileVisibility(settings.watchlist_visibility || 'friends');
        setPrivateTitles(settings.private_titles || []);
      } else {
        // Bei 500er Fehler setzen wir Standardwerte
        console.log('Fehler beim Laden der Einstellungen, verwende Standardwerte');
        setProfileVisibility('friends');
        setPrivateTitles([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Einstellungen:', err);
      // Bei Fehlern setzen wir auch Standardwerte
      setProfileVisibility('friends');
      setPrivateTitles([]);
    }
  };

  // Lade Einstellungen beim Start
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('Kein Token gefunden');
          return;
        }
        
        // Zuerst sicherstellen, dass die Watchlist existiert
        await fetch('http://localhost:8000/api/watchlist', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Dann die privaten Tags laden
        await loadPrivateTags();
        
        // Dann die Einstellungen laden
        await loadWatchlistSettings();
      } catch (err) {
        console.error('Fehler beim Initialisieren der Einstellungen:', err);
      }
    };
    
    initializeSettings();
  }, []);

  // Aktualisiere die privaten Tags wenn sich die Einstellungen öffnen
  useEffect(() => {
    if (settingsOpen) {
      loadPrivateTags();
    }
  }, [settingsOpen]);

  // Funktion zum Speichern der privaten Tags/Titel in der Watchlist
  const saveWatchlistSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const updatedMovies = [...movies];
      
      // Aktualisiere die is_private Eigenschaft und Tags für alle Filme
      for (const movie of updatedMovies) {
        const isPrivateTitle = privateTitles.some(pt => pt.id === movie.id);
        const movieTags = Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []);
        
        // Aktualisiere die Tags mit den privaten Tag-Einstellungen
        const updatedTags = movieTags.map(tag => {
          const isPrivate = privateTags.some(pt => pt.label === tag.label);
          return {
            ...tag,
            is_private: isPrivate
          };
        });

        // Wenn mindestens ein Tag privat ist oder der Titel als privat markiert wurde
        const hasPrivateTag = updatedTags.some(tag => tag.is_private);
        const shouldBePrivate = isPrivateTitle || hasPrivateTag;

        const updatedMovie = {
          ...movie,
          tags: updatedTags,
          is_private: shouldBePrivate
        };

        console.log('Aktualisiere Film:', updatedMovie.title, {
          isPrivateTitle,
          hasPrivateTag,
          shouldBePrivate,
          tags: updatedTags
        });

        // Speichere im Backend
        await fetch(`http://localhost:8000/api/watchlist/movies/${movie.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedMovie)
        });
      }

      // Aktualisiere den lokalen Zustand
      setMovies(updatedMovies);
      
      // Aktualisiere die privaten Tags
      await loadPrivateTags();
      
      // Zeige Erfolgsmeldung
      setSuccess('Einstellungen erfolgreich gespeichert');
      setTimeout(() => setSuccess(null), 3000);
      
      // Schließe das Einstellungsfenster
      setSettingsOpen(false);
      
      // Lade die Filme neu
      await fetchMovies();
      
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Fehler beim Speichern der Einstellungen: ' + err.message);
      setTimeout(() => setError(null), 3000);
    }
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
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <WatchlistHeader 
          username={username}
          navigate={navigate}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          fetchMovies={fetchMovies}
          setFilterOpen={setFilterOpen}
          setSettingsOpen={setSettingsOpen}
          handleOpenMultiplayer={handleOpenMultiplayer}
        />
        
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

          {filteredMovies.length === 0 ? (
            <Typography
              variant="body1"
              sx={{
                color: 'white',
                textAlign: 'center'
              }}
            >
              Keine passenden Einträge gefunden.
            </Typography>
          ) : (
            <Grid container spacing={3}>
              {filteredMovies.map((movie) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={movie.id}>
                  <MediaCard
                    item={movie}
                    onClick={() => handleOpenDetail(movie)}
                    onEdit={() => handleOpenDetail(movie)}
                    onDelete={() => handleDeleteMovie(movie)}
                    showEditButton={true}
                    showAddButton={false}
                    isGroupWatchlist={false}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Komponenten für Modals */}
        <WatchlistSettings
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          settingsTab={settingsTab}
          setSettingsTab={setSettingsTab}
          profileVisibility={profileVisibility}
          setProfileVisibility={setProfileVisibility}
          allTags={allTags}
          privateTags={privateTags}
          setPrivateTags={setPrivateTags}
          privateTitles={privateTitles}
          setPrivateTitles={setPrivateTitles}
          movies={movies}
          saveWatchlistSettings={saveWatchlistSettings}
        />

        <WatchlistDetail
          open={detailModalOpen}
          onClose={handleCloseDetail}
          selectedItem={selectedItem}
          status={status}
          setStatus={setStatus}
          abbruchGrund={abbruchGrund}
          setAbbruchGrund={setAbbruchGrund}
          rating={rating}
          setRating={setRating}
          notes={notes}
          setNotes={setNotes}
          tags={tags}
          setTags={setTags}
          tagInput={tagInput}
          setTagInput={setTagInput}
          tagColor={tagColor}
          setTagColor={setTagColor}
          allTags={allTags}
          onSave={handleSaveDetail}
          isEdit={isEdit}
          readOnly={false}
          isPrivate={isPrivate}
          setIsPrivate={setIsPrivate}
        />

        <WatchlistFilter
          filterOpen={filterOpen}
          setFilterOpen={setFilterOpen}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterTags={filterTags}
          setFilterTags={setFilterTags}
          allTags={allTags}
          privacyFilter={privacyFilter}
          setPrivacyFilter={setPrivacyFilter}
        />

        <MultiplayerDialog
          open={multiplayerOpen}
          setMultiplayerOpen={setMultiplayerOpen}
          friendsWithWatchlist={friendsWithWatchlist}
          navigate={navigate}
        />
      </Container>
    </Box>
  );
};

export default Watchlist; 