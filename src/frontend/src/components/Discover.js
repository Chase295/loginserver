import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Tooltip
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
import Rating from '@mui/material/Rating';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import Autocomplete from '@mui/material/Autocomplete';
import MediaCard from './MediaCard';
import WatchlistDetail from './watchlist/WatchlistDetail';

const Discover = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const groupId = searchParams.get('groupId');
  const groupName = searchParams.get('groupName');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayMode, setDisplayMode] = useState(
    localStorage.getItem('preferredDisplayMode') || 'trending'
  );
  const [success, setSuccess] = useState(null);
  const token = localStorage.getItem('token');
  
  // Zustand für die Detailansicht
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Im State ergänzen:
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
  const [isPrivate, setIsPrivate] = useState(false);

  // Verbesserte Token-Überprüfung
  useEffect(() => {
    if (!token) {
      console.log('[Discover] Kein Token gefunden, navigiere zu Login');
      navigate('/login');
      return;
    }
  }, [token, navigate]);

  // Verbesserte Zurück-Navigation
  const handleBack = () => {
    if (!token) {
      console.log('[Discover] Kein Token bei Zurück-Navigation, navigiere zu Login');
      navigate('/login');
      return;
    }

    if (groupId) {
      console.log(`[Discover] Navigiere zurück zur Gruppe ${groupId}`);
      navigate(`/group-watchlist/${groupId}`);
    } else {
      console.log('[Discover] Navigiere zurück zur persönlichen Watchlist');
      navigate('/watchlist');
    }
  };

  // Lade die initialen Daten basierend auf den Präferenzen
  useEffect(() => {
    if (!token) return;
    console.log('[Discover] Lade Inhalte für Displaymodus:', displayMode);
    loadContent();
  }, [displayMode, token]);

  // Lade Trending oder Upcoming Inhalte für beide Typen
  const loadContent = async () => {
    if (!token) {
      console.log('[Discover] Kein Token beim Laden der Inhalte');
      navigate('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endpoint = displayMode === 'trending' ? 'trending' : 'upcoming';
      // Beide Typen parallel laden
      const [moviesRes, tvRes] = await Promise.all([
        fetch(`http://localhost:8000/api/${endpoint}?type=movie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/${endpoint}?type=tv`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      if (!moviesRes.ok && !tvRes.ok) {
        throw new Error('Fehler beim Laden der Inhalte');
      }
      const moviesData = moviesRes.ok ? await moviesRes.json() : { results: [] };
      const tvData = tvRes.ok ? await tvRes.json() : { results: [] };
      
      // Lade zusätzliche Details für Serien
      const tvWithDetails = await Promise.all(
        (tvData.results || []).map(async (item) => {
          try {
            const detailsRes = await fetch(`http://localhost:8000/api/tv/${item.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (detailsRes.ok) {
              const details = await detailsRes.json();
              return {
                ...item,
                media_type: 'tv',
                number_of_seasons: details.number_of_seasons,
                status: details.status,
                status_de: details.status === 'Returning Series' ? 'Laufend' :
                         details.status === 'Ended' ? 'Abgeschlossen' :
                         details.status === 'Canceled' ? 'Abgebrochen' :
                         details.status === 'In Production' ? 'In Produktion' :
                         details.status,
                in_production: details.in_production
              };
            }
            return { ...item, media_type: 'tv' };
          } catch (err) {
            console.error('Fehler beim Laden der Serien-Details:', err);
            return { ...item, media_type: 'tv' };
          }
        })
      );

      // Filme mit media_type ergänzen
      const movies = (moviesData.results || []).map(item => ({ ...item, media_type: 'movie' }));
      
      // Zusammenführen und nach Beliebtheit sortieren
      const all = [...movies, ...tvWithDetails].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      setContent(all);
    } catch (err) {
      console.error('Fehler:', err);
      setError('Fehler beim Laden der Inhalte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Suche nach Inhalten in beiden Typen
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const [moviesRes, tvRes] = await Promise.all([
        fetch(`http://localhost:8000/api/search?q=${encodeURIComponent(searchTerm)}&type=movie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/search?q=${encodeURIComponent(searchTerm)}&type=tv`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      if (!moviesRes.ok && !tvRes.ok) {
        throw new Error('Fehler bei der Suche');
      }
      const moviesData = moviesRes.ok ? await moviesRes.json() : { results: [] };
      const tvData = tvRes.ok ? await tvRes.json() : { results: [] };
      const movies = (moviesData.results || []).map(item => ({ ...item, media_type: 'movie' }));
      const tv = (tvData.results || []).map(item => ({ ...item, media_type: 'tv' }));
      const all = [...movies, ...tv].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      setContent(all);
    } catch (err) {
      console.error('Fehler:', err);
      setError('Fehler bei der Suche: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Debug-Funktion für korrekte Formatierung
  const cleanupObject = (obj) => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Falls es ein Array ist
    if (Array.isArray(obj)) {
      return obj.map(item => cleanupObject(item));
    }
    
    // Falls es ein Objekt ist
    const cleanObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Nur primitive Werte und Arrays/Objekte übernehmen, Funktionen überspringen
        if (typeof obj[key] !== 'function' && key !== 'ref') {
          cleanObj[key] = cleanupObject(obj[key]);
        }
      }
    }
    return cleanObj;
  };

  // Verbessere die handleAddToWatchlist-Funktion
  const handleAddToWatchlist = async (item) => {
    try {
      setError(null);
      setSuccess(null);
      const token = localStorage.getItem('token');
      const cleanTags = tags.map(tag => ({
        label: String(tag.label || ''),
        color: String(tag.color || '#000000')
      }));
      const movieData = {
        title: item.title || item.name,
        year: item.release_date 
          ? new Date(item.release_date).getFullYear() 
          : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : null),
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        tmdb_id: item.id.toString(),
        media_type: item.media_type,
        backdrop_path: item.backdrop_path,
        overview: item.overview,
        vote_average: item.vote_average,
        genres: item.genres || [],
        status,
        abbruch_grund: status === 'abgebrochen' ? abbruchGrund : undefined,
        rating: rating || 0,
        notes: notes || '',
        tags: cleanTags
      };
      Object.keys(movieData).forEach(key => {
        if (movieData[key] === undefined || movieData[key] === null) {
          delete movieData[key];
        }
      });
      const safeData = JSON.parse(JSON.stringify(movieData));
      let response;
      if (isEdit && editId) {
        // Update
        response = await fetch(`http://localhost:8000/api/watchlist/movies/${editId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(safeData)
        });
      } else {
        // Neu anlegen
        response = await fetch('http://localhost:8000/api/watchlist/movies', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(safeData)
        });
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fehler beim Hinzufügen zur Watchlist');
      }
      setSuccess(`"${movieData.title}" wurde ${isEdit ? 'aktualisiert' : 'zur Watchlist hinzugefügt'}.`);
      setTimeout(() => { setSuccess(null); }, 3000);
      handleCloseDetail();
      setStatus('watchlist');
      setRating(0);
      setNotes('');
      setTags([]);
      setAbbruchGrund('');
    } catch (err) {
      console.error('Fehler beim Hinzufügen zur Watchlist:', err);
      setError(err.message);
      setTimeout(() => { setError(null); }, 3000);
    }
  };
  
  // Lade User-Tags aus dem Backend
  const fetchUserTags = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      let tags = [];

      // Wenn wir in einer Gruppen-Discovery sind
      if (groupId) {
        // Hole die Gruppen-Tags
        const groupResponse = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/movies`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (groupResponse.ok) {
          const groupMovies = await groupResponse.json();
          // Extrahiere alle einzigartigen Tags aus den Gruppen-Filmen
          const groupTags = new Set();
          groupMovies.forEach(movie => {
            if (movie.tags) {
              const movieTags = Array.isArray(movie.tags) ? movie.tags : JSON.parse(movie.tags);
              movieTags.forEach(tag => {
                if (!tag.is_private) {  // Nur öffentliche Tags
                  groupTags.add(JSON.stringify(tag));
                }
              });
            }
          });
          tags = [...new Set([...tags, ...Array.from(groupTags).map(tag => JSON.parse(tag))])];
        }
      } else {
        // Hole die privaten Tags
        const response = await fetch('http://localhost:8000/api/user/tags', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const userTags = await response.json();
          tags = [...new Set([...tags, ...userTags])];
        }
      }

      setAllTags(tags);
      localStorage.setItem('allTags', JSON.stringify(tags));
    } catch (e) {
      console.error('Fehler beim Laden der Tags:', e);
    }
  };

  // Öffne die Detailansicht eines Films/einer Serie
  const handleOpenDetail = async (item) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
    setStatus('watchlist');
    setRating(0);
    setNotes('');
    setTags([]);
    setAbbruchGrund('');
    setTagInput('');
    setTagColor('#2196f3');
    setIsEdit(false);
    setEditId(null);
    setIsPrivate(false);
    fetchUserTags();

    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const tmdbId = item.id?.toString() || item.tmdb_id?.toString();

      let response;
      if (groupId) {
        // Prüfe zuerst in der Gruppen-Watchlist
        console.log('Suche Film in Gruppen-Watchlist:', { groupId, tmdbId, mediaType: item.media_type });
        const groupResponse = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/movies`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (groupResponse.ok) {
          const groupMovies = await groupResponse.json();
          const existingMovie = groupMovies.find(m => 
            m.tmdb_id === tmdbId && m.media_type === item.media_type
          );
          
          if (existingMovie) {
            console.log('Film in Gruppen-Watchlist gefunden:', existingMovie);
            setIsEdit(true);
            setEditId(existingMovie.id);
            setStatus(existingMovie.status || 'watchlist');
            setRating(existingMovie.rating ? Number(existingMovie.rating) : 0);
            setNotes(existingMovie.notes || '');
            setTags(Array.isArray(existingMovie.tags) ? existingMovie.tags : 
                   (existingMovie.tags ? JSON.parse(existingMovie.tags) : []));
            setAbbruchGrund(existingMovie.abbruch_grund || '');
            return;
          }
        }
      } else {
        // Prüfe in der persönlichen Watchlist
        response = await fetch(`http://localhost:8000/api/watchlist/movie/${tmdbId}/${item.media_type}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.id) {
            console.log('Film in persönlicher Watchlist gefunden:', data);
            setIsEdit(true);
            setEditId(data.id);
            setStatus(data.status || 'watchlist');
            setRating(data.rating ? Number(data.rating) : 0);
            setNotes(data.notes || '');
            setTags(Array.isArray(data.tags) ? data.tags : (data.tags ? JSON.parse(data.tags) : []));
            setAbbruchGrund(data.abbruch_grund || '');
            setIsPrivate(data.is_private === true);
          }
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden der Film-Details:', e);
    }
  };
  
  // Schließe die Detailansicht
  const handleCloseDetail = () => {
    setDetailModalOpen(false);
  };

  const handleAddTag = (tag) => {
    if (!tags.some(t => t.label === tag.label)) {
      // Füge is_private basierend auf dem Kontext hinzu
      const newTag = {
        ...tag,
        is_private: false,  // In der Discovery immer öffentliche Tags für Gruppen
        user_id: localStorage.getItem('userId')
      };
      
      setTags([...tags, newTag]);
      
      // Füge den Tag zur globalen Liste hinzu, wenn er noch nicht existiert
      if (!allTags.some(t => t.label === tag.label)) {
        const updated = [...allTags, newTag];
        setAllTags(updated);
        localStorage.setItem('allTags', JSON.stringify(updated));
      }
    }
  };

  // Status-Konfiguration für Icons und Farben
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

  // Hilfsfunktion für verfügbare Tags (2. Reihe)
  const availableTags = allTags.filter(tag => {
    // Wenn wir in einer Gruppen-Watchlist sind
    if (groupId) {
      // Zeige nur öffentliche Tags, die noch nicht verwendet wurden
      return !tag.is_private && !tags.some(t => t.label === tag.label);
    }
    // In der privaten Discovery zeige alle Tags des Users
    return !tags.some(t => t.label === tag.label);
  });

  const handleSaveDetail = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!selectedItem || !token) return;

      // Prüfe, ob mindestens ein privater Tag vorhanden ist
      const hasPrivateTag = tags.some(tag => tag.is_private === true);

      const movieData = {
        title: selectedItem.title || selectedItem.name,
        year: selectedItem.release_date?.substring(0, 4) || selectedItem.first_air_date?.substring(0, 4),
        poster_url: selectedItem.poster_path ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}` : null,
        tmdb_id: selectedItem.id.toString(),
        media_type: selectedItem.media_type,
        backdrop_path: selectedItem.backdrop_path,
        overview: selectedItem.overview,
        vote_average: selectedItem.vote_average,
        genres: selectedItem.genres || selectedItem.genre_ids?.map(id => ({ id })),
        status,
        abbruch_grund: status === 'abgebrochen' ? abbruchGrund : null,
        rating: Number(rating),
        notes,
        tags: tags.map(tag => ({
          label: tag.label,
          color: tag.color,
          is_private: tag.is_private === true
        })),
        is_private: isPrivate || hasPrivateTag // Setze auf privat wenn entweder manuell gewählt oder private Tags vorhanden
      };

      console.log('Sende Film-Daten:', {
        ...movieData,
        rating: movieData.rating,
        ratingType: typeof movieData.rating,
        isPrivate: movieData.is_private,
        hasPrivateTag
      });

      const safeData = JSON.parse(JSON.stringify(movieData));
      let response;

      // Unterscheide zwischen Gruppen- und persönlicher Watchlist
      const endpoint = groupId 
        ? `http://localhost:8000/api/watchlist/groups/${groupId}/movies`
        : 'http://localhost:8000/api/watchlist/movies';

      response = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',  // Korrigiere die Methode basierend auf isEdit
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(safeData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Fehler beim Hinzufügen zur Watchlist');
      }

      const destination = groupId 
        ? `zur Gruppen-Watchlist "${groupName}"`
        : 'zur Watchlist';

      setSuccess(`"${movieData.title}" wurde ${isEdit ? 'aktualisiert' : destination + ' hinzugefügt'}.`);
      setTimeout(() => { setSuccess(null); }, 3000);
      handleCloseDetail();
      setStatus('watchlist');
      setRating(0);
      setNotes('');
      setTags([]);
      setAbbruchGrund('');
      setIsPrivate(false);
    } catch (err) {
      console.error('Fehler beim Hinzufügen zur Watchlist:', err);
      setError(err.message);
      setTimeout(() => { setError(null); }, 3000);
    }
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
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <IconButton
            onClick={handleBack}
            sx={{
              color: '#00ff9d',
              mr: 2,
              '&:hover': {
                backgroundColor: 'rgba(0, 255, 157, 0.1)'
              }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              color: '#00ff9d',
              flexGrow: 1
            }}
          >
            {groupId ? `Entdecken für ${groupName}` : 'Entdecken'}
          </Typography>
        </Box>

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

          {/* Kompakte Filter- und Suchleiste */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              mb: 4,
              background: 'rgba(30,30,40,0.45)',
              borderRadius: 3,
              boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
              backdropFilter: 'blur(8px)',
              overflowX: 'auto',
              minHeight: 64,
            }}
          >
            {/* Displaymodus-Chips */}
            <Chip
              icon={<TrendingUpIcon sx={{ fontSize: 20 }} />}
              label={<span style={{ fontWeight: 600, fontSize: 15 }}>🔥 Trending</span>}
              onClick={() => {
                setDisplayMode('trending');
                localStorage.setItem('preferredDisplayMode', 'trending');
              }}
              sx={{
                bgcolor: displayMode === 'trending' ? 'rgba(255, 0, 98, 0.8)' : 'rgba(255, 255, 255, 0.08)',
                color: 'white',
                borderColor: displayMode === 'trending' ? '#ff0062' : 'transparent',
                border: '2px solid',
                fontWeight: displayMode === 'trending' ? 'bold' : 'normal',
                fontSize: 15,
                borderRadius: 999,
                px: 1.5,
                py: 0.5,
                minHeight: 36,
                minWidth: 0,
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(255, 0, 98, 0.6)',
                }
              }}
            />
            <Chip
              icon={<NewReleasesIcon sx={{ fontSize: 20 }} />}
              label={<span style={{ fontWeight: 600, fontSize: 15 }}>✨ Neu & Kommend</span>}
              onClick={() => {
                setDisplayMode('upcoming');
                localStorage.setItem('preferredDisplayMode', 'upcoming');
              }}
              sx={{
                bgcolor: displayMode === 'upcoming' ? 'rgba(144, 0, 255, 0.8)' : 'rgba(255, 255, 255, 0.08)',
                color: 'white',
                borderColor: displayMode === 'upcoming' ? '#9000ff' : 'transparent',
                border: '2px solid',
                fontWeight: displayMode === 'upcoming' ? 'bold' : 'normal',
                fontSize: 15,
                borderRadius: 999,
                px: 1.5,
                py: 0.5,
                minHeight: 36,
                minWidth: 0,
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'rgba(144, 0, 255, 0.6)',
                }
              }}
            />
            {/* Suchleiste wie Watchlist */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
              <TextField
                variant="outlined"
                placeholder="Titel suchen..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                size="small"
                sx={{ minWidth: 260, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(e); }}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
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
              >
                Suchen
              </Button>
            </Box>
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
                <MediaCard
                  item={item}
                  onAdd={handleAddToWatchlist}
                  showAddButton={true}
                  onClick={() => handleOpenDetail(item)}
                />
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
                            icon={selectedItem.media_type === 'tv' ? <TvIcon /> : <MovieIcon />}
                            label={selectedItem.media_type === 'tv' ? 'Serie' : 'Film'}
                            size="small"
                            sx={{ 
                              bgcolor: selectedItem.media_type === 'tv' 
                                ? 'rgba(66, 133, 244, 0.7)' 
                                : 'rgba(230, 81, 0, 0.7)', 
                              color: 'white' 
                            }}
                          />
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
                        {selectedItem.media_type === 'tv' && (
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
                        {selectedItem.media_type === 'movie' && (
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

                        {/* Neue Infos */}
                        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {/* Status-Auswahl */}
                          <Box>
                            <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>Status</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {Object.keys(statusConfig).map(stat => (
                                <Box 
                                  key={stat}
                                  onClick={() => setStatus(stat)}
                                  sx={{
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    px: 2, 
                                    py: 1,
                                    borderRadius: 6,
                                    background: status === stat ? statusConfig[stat].color : 'rgba(255,255,255,0.05)',
                                    color: status === stat ? statusConfig[stat].text : '#999',
                                    fontWeight: 'bold',
                                    fontSize: '1rem',
                                    boxShadow: status === stat ? `0 0 12px 2px ${statusConfig[stat].color}` : 'none',
                                    border: '1.5px solid rgba(255,255,255,0.12)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                      background: statusConfig[stat].color,
                                      color: statusConfig[stat].text,
                                      boxShadow: `0 0 8px 1px ${statusConfig[stat].color}`
                                    }
                                  }}
                                >
                                  {statusConfig[stat].icon}
                                  <span>{statusConfig[stat].label}</span>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          
                          {/* Abbruchgrund nur wenn abgebrochen */}
                          {status === 'abgebrochen' && (
                            <TextField 
                              label="Abbruch-Grund" 
                              value={abbruchGrund} 
                              onChange={e => setAbbruchGrund(e.target.value)} 
                              fullWidth
                              variant="outlined"
                              sx={{
                                mt: 1,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 3,
                                  backgroundColor: 'rgba(255,0,98,0.05)',
                                  '& fieldset': {
                                    borderColor: 'rgba(255,0,98,0.3)',
                                  },
                                  '&:hover fieldset': {
                                    borderColor: 'rgba(255,0,98,0.5)',
                                  },
                                  '&.Mui-focused fieldset': {
                                    borderColor: '#ff0062',
                                  }
                                },
                                '& .MuiInputLabel-root': {
                                  color: 'rgba(255,0,98,0.7)',
                                }
                              }}
                            />
                          )}
                          
                          {/* Bewertung */}
                          <Box>
                            <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>Bewertung</Typography>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              p: 2,
                              borderRadius: 3,
                              background: 'rgba(255,255,255,0.05)',
                              boxShadow: rating > 0 ? '0 0 10px 2px rgba(255,215,0,0.2)' : 'none',
                              transition: 'box-shadow 0.3s',
                            }}>
                              <Rating
                                name="movie-rating"
                                value={rating}
                                max={10}
                                onChange={(e, newValue) => setRating(newValue)}
                                sx={{
                                  '& .MuiRating-iconFilled': {
                                    color: '#FFD700',
                                  },
                                  '& .MuiRating-iconHover': {
                                    color: '#FFEB3B',
                                  },
                                  '& .MuiRating-icon': {
                                    filter: rating > 0 ? 'drop-shadow(0 0 3px rgba(255,215,0,0.7))' : 'none'
                                  }
                                }}
                              />
                              <Typography sx={{ ml: 2, color: rating > 0 ? '#FFD700' : '#999' }}>
                                {rating}/10
                              </Typography>
                            </Box>
                          </Box>
                          
                          {/* Notizen */}
                          <Box>
                            <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>Notizen</Typography>
                            <TextField
                              label="Deine Gedanken zum Film..."
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              fullWidth
                              multiline
                              minRows={3}
                              variant="outlined"
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: 3,
                                  background: 'rgba(255,255,255,0.03)',
                                  '& fieldset': {
                                    borderColor: 'rgba(255,255,255,0.2)',
                                  },
                                  '&:hover fieldset': {
                                    borderColor: 'rgba(255,255,255,0.3)',
                                  },
                                  '&.Mui-focused fieldset': {
                                    borderColor: '#00ff9d',
                                  }
                                }
                              }}
                            />
                          </Box>
                          
                          {/* Tags 3-reihig */}
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>Tags</Typography>
                            {/* 1. Reihe: Aktive Tags */}
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5, mb: 0.5, fontWeight: 500 }}>Vergebene Tags für diesen Titel</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                              {tags.map((tag, idx) => (
                                <Chip
                                  key={tag.label + tag.color + idx}
                                  label={tag.label}
                                  icon={<Box sx={{ background: tag.color, borderRadius: '50%', width: 14, height: 14, display: 'inline-block', marginRight: 4 }} />}
                                  onDelete={() => setTags(tags.filter((_, i) => i !== idx))}
                                  sx={{
                                    bgcolor: 'rgba(20,20,35,0.8)',
                                    color: tag.color,
                                    fontWeight: 'bold',
                                    borderRadius: 50,
                                    px: 1.5,
                                    mb: 0.5,
                                    border: `1px solid ${tag.color}55`,
                                    boxShadow: `0 2px 8px 0 ${tag.color}22`,
                                    mr: 0.5,
                                    fontSize: '0.9rem',
                                    textShadow: `0 0 6px ${tag.color}99`,
                                    transition: 'all 0.2s',
                                  }}
                                />
                              ))}
                            </Box>
                            {/* 2. Reihe: Vorschlags-Tags */}
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', ml: 0.5, mb: 0.5, fontWeight: 400 }}>Deine bisherigen Tags (zum Hinzufügen anklicken)</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                              {availableTags.length > 0 && availableTags.map((tag, idx) => (
                                <Chip
                                  key={tag.label + tag.color + idx}
                                  label={tag.label}
                                  icon={<Box sx={{ background: tag.color, borderRadius: '50%', width: 14, height: 14, display: 'inline-block', marginRight: 4 }} />}
                                  onClick={() => setTags([...tags, tag])}
                                  sx={{
                                    bgcolor: 'rgba(20,20,35,0.5)',
                                    color: tag.color,
                                    fontWeight: 'bold',
                                    borderRadius: 50,
                                    px: 1.5,
                                    mb: 0.5,
                                    border: `1px solid ${tag.color}55`,
                                    boxShadow: `0 2px 8px 0 ${tag.color}22`,
                                    mr: 0.5,
                                    fontSize: '0.9rem',
                                    textShadow: `0 0 6px ${tag.color}99`,
                                    transition: 'all 0.2s',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      bgcolor: 'rgba(40,40,55,0.9)',
                                      opacity: 1
                                    }
                                  }}
                                />
                              ))}
                            </Box>
                            {/* 3. Reihe: Neuen Tag erstellen */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <Box 
                                sx={{
                                  position: 'relative',
                                  width: 44,
                                  height: 44,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  document.getElementById('color-picker').click();
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '50%',
                                    background: tagColor,
                                    boxShadow: `0 0 10px 2px ${tagColor}55`,
                                    border: '2.5px solid #fff',
                                    transition: 'box-shadow 0.2s, border 0.2s',
                                  }}
                                />
                                <input 
                                  id="color-picker"
                                  type="color" 
                                  value={tagColor} 
                                  onChange={e => setTagColor(e.target.value)} 
                                  style={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0,
                                    cursor: 'pointer',
                                    border: 'none',
                                    padding: 0,
                                    margin: 0,
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    zIndex: 2
                                  }} 
                                  tabIndex={-1}
                                />
                              </Box>
                              <TextField
                                variant="outlined"
                                placeholder="Neuen Tag erstellen..."
                                size="small"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && tagInput) {
                                    handleAddTag({ label: tagInput, color: tagColor });
                                    setTagInput('');
                                    e.preventDefault();
                                  }
                                }}
                                sx={{ minWidth: 180 }}
                              />
                              <Button 
                                variant="contained"
                                onClick={() => {
                                  if (tagInput.trim()) {
                                    handleAddTag({ label: tagInput, color: tagColor });
                                    setTagInput('');
                                  }
                                }}
                                sx={{
                                  borderRadius: 2,
                                  px: 2,
                                  py: 1,
                                  minWidth: '50px',
                                  height: '40px',
                                  background: `linear-gradient(45deg, ${tagColor}, ${tagColor}aa)`,
                                  boxShadow: `0 4px 15px ${tagColor}55`,
                                  '&:hover': {
                                    background: `linear-gradient(45deg, ${tagColor}, ${tagColor})`,
                                    boxShadow: `0 6px 20px ${tagColor}77`
                                  }
                                }}
                              >
                                <AddIcon />
                              </Button>
                            </Box>
                          </Box>

                          {/* Private/Public Toggle nur für persönliche Watchlist */}
                          {!groupId && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                                Sichtbarkeit
                              </Typography>
                              <ToggleButtonGroup
                                value={isPrivate ? 'private' : 'public'}
                                exclusive
                                onChange={(e, newValue) => {
                                  if (newValue !== null) {
                                    setIsPrivate(newValue === 'private');
                                  }
                                }}
                                sx={{
                                  background: 'rgba(255,255,255,0.05)',
                                  borderRadius: 3,
                                  p: 0.5
                                }}
                              >
                                <ToggleButton 
                                  value="public"
                                  sx={{
                                    px: 3,
                                    py: 1,
                                    color: !isPrivate ? '#00ff9d' : 'rgba(255,255,255,0.5)',
                                    '&.Mui-selected': {
                                      backgroundColor: 'rgba(0,255,157,0.15)',
                                      color: '#00ff9d',
                                      '&:hover': {
                                        backgroundColor: 'rgba(0,255,157,0.25)',
                                      }
                                    }
                                  }}
                                >
                                  Öffentlich
                                </ToggleButton>
                                <ToggleButton 
                                  value="private"
                                  sx={{
                                    px: 3,
                                    py: 1,
                                    color: isPrivate ? '#ff0062' : 'rgba(255,255,255,0.5)',
                                    '&.Mui-selected': {
                                      backgroundColor: 'rgba(255,0,98,0.15)',
                                      color: '#ff0062',
                                      '&:hover': {
                                        backgroundColor: 'rgba(255,0,98,0.25)',
                                      }
                                    }
                                  }}
                                >
                                  Privat
                                </ToggleButton>
                              </ToggleButtonGroup>
                            </Box>
                          )}
                        </Box>
                        
                        {/* Hinzufügen-Button (groß, modern) */}
                        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                          <Button
                            variant="contained"
                            startIcon={!isEdit ? <AddIcon /> : null}
                            onClick={handleSaveDetail}
                            sx={{
                              py: 1.5,
                              px: 4,
                              borderRadius: 6,
                              fontSize: '1.1rem',
                              fontWeight: 'bold',
                              background: 'linear-gradient(45deg, #00ff9d, #00aeff)',
                              boxShadow: '0 8px 20px rgba(0, 255, 157, 0.3)',
                              transition: 'all 0.3s ease',
                              border: '2px solid rgba(255,255,255,0.1)',
                              color: '#000',
                              '&:hover': {
                                background: 'linear-gradient(45deg, #00ff9d, #00aeff)',
                                transform: 'translateY(-3px)',
                                boxShadow: '0 12px 25px rgba(0, 255, 157, 0.5)',
                              },
                              '&:active': {
                                transform: 'translateY(1px)',
                                boxShadow: '0 5px 15px rgba(0, 255, 157, 0.4)',
                              }
                            }}
                          >
                            {isEdit ? 'Speichern' : 'Zur Watchlist hinzufügen'}
                          </Button>
                        </Box>
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