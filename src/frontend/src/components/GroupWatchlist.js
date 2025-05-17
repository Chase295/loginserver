import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Switch,
  Alert,
  Snackbar,
  InputAdornment
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchComponent from './watchlist/SearchComponent';
import SettingsIcon from '@mui/icons-material/Settings';
import ExploreIcon from '@mui/icons-material/Explore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import MediaCard from './MediaCard';
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
import GroupWatchlistHeader from './groupWatchlist/GroupWatchlistHeader';
import GroupWatchlistSettings from './groupWatchlist/GroupWatchlistSettings';
import GroupWatchlistSearch from './groupWatchlist/GroupWatchlistSearch';

const GroupWatchlist = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [movies, setMovies] = useState([]);
  const [acceptedGroups, setAcceptedGroups] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState(0);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [privacyFilter, setPrivacyFilter] = useState('all');
  const [friendsWithWatchlist, setFriendsWithWatchlist] = useState([]);

  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  // Lade alle Gruppen und Einladungen
  const loadGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[GroupWatchlist] Loading groups and invites');
      
      const response = await fetch('http://localhost:8000/api/watchlist/groups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Laden der Gruppen');
      }
      
      const data = await response.json();
      console.log('[GroupWatchlist] Loaded groups data structure:', {
        hasAccepted: Array.isArray(data.accepted),
        acceptedLength: data.accepted?.length || 0,
        hasPending: Array.isArray(data.pending),
        pendingLength: data.pending?.length || 0,
        rawData: data
      });
      
      if (!data.accepted || !data.pending) {
        console.error('[GroupWatchlist] Invalid data structure received:', data);
        throw new Error('Ungültiges Datenformat von der API');
      }
      
      setAcceptedGroups(data.accepted);
      setPendingInvites(data.pending);
      
    } catch (err) {
      console.error('[GroupWatchlist] Error loading groups:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    const initializeGroupWatchlist = async () => {
      try {
        await loadGroups();
        await fetchMovies();
        await fetchUserTags();
        await checkInviteStatus(); // Initial check
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    
    initializeGroupWatchlist();
  }, [groupId, navigate]);

  // Einladung annehmen
  const handleAcceptInvite = async (groupId) => {
    try {
      setLoading(true);
      console.log(`[GroupWatchlist] Accepting invite for group ${groupId}`);
      
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/invites/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Annehmen der Einladung');
      }

      setSuccess('Einladung erfolgreich angenommen');
      await loadGroups();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Einladung ablehnen
  const handleRejectInvite = async (groupId) => {
    try {
      setLoading(true);
      console.log(`[GroupWatchlist] Rejecting invite for group ${groupId}`);
      
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/invites/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Ablehnen der Einladung');
      }

      setSuccess('Einladung abgelehnt');
      await loadGroups();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Lade Filme der Gruppe
  const fetchMovies = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/movies`, {
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
          const mediaType = movie.media_type || 'movie';
          
          if (mediaType === 'tv' && movie.tmdb_id) {
            try {
              const detailsResponse = await fetch(`http://localhost:8000/api/tv/${movie.tmdb_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                return {
                  ...movie,
                  media_type: 'tv',
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
            media_type: mediaType
          };
        })
      );
      
      setMovies(moviesWithDetails);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchUserTags = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Fehler beim Laden der Tags');
      const data = await response.json();
      setAllTags(data);
    } catch (err) {
      console.error('Fehler beim Laden der Tags:', err);
    }
  };

  // Einladungsstatus überprüfen
  const checkInviteStatus = async () => {
    try {
      console.log(`[GroupWatchlist] Checking invite status for group ${groupId}`);
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/membership-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.error('[GroupWatchlist] Error checking invite status:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('[GroupWatchlist] Invite status:', data);
      
      if (data.status === 'pending') {
        setHasPendingInvite(true);
      } else if (data.status === 'accepted') {
        setHasPendingInvite(false);
        await loadGroups();
      }
    } catch (err) {
      console.error('[GroupWatchlist] Error in checkInviteStatus:', err);
    }
  };

  const handleSettingsClick = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
  };

  const handleDeleteMovie = async (movie) => {
    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/movies/${movie.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Fehler beim Löschen des Titels');
      }
      await fetchMovies();
      setSuccess('Titel erfolgreich gelöscht');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOpenDetail = (item) => {
    console.log('Öffne Detail mit Item:', item);
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
    console.log('Detail geöffnet. Rating:', item.rating, 'als Number:', Number(item.rating));
  };

  const handleCloseDetail = () => {
    setDetailModalOpen(false);
    setSelectedItem(null);
    setIsEdit(false);
    setEditId(null);
  };

  const handleSaveDetail = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      console.log('Start handleSaveDetail mit Rating:', rating, 'Typ:', typeof rating);
      
      if (!editId) {
        throw new Error('Keine Film-ID zum Aktualisieren gefunden');
      }

      if (!groupId) {
        throw new Error('Keine Gruppen-ID gefunden');
      }

      const cleanTags = tags.map(tag => ({
        label: String(tag.label || ''),
        color: String(tag.color || '#000000')
      }));

      const movieData = {
        status: status || 'watchlist',
        rating: Number(rating),
        notes: notes || '',
        abbruch_grund: status === 'abgebrochen' ? abbruchGrund : null,
        tags: cleanTags
      };

      console.log('Sende Update-Request mit Daten:', {
        url: `http://localhost:8000/api/watchlist/groups/${groupId}/movies/${editId}`,
        movieData
      });

      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/movies/${editId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(movieData)
      });

      const responseData = await response.json();
      console.log('Server Antwort:', responseData);

      if (!response.ok) {
        const error = new Error(responseData.error || 'Fehler beim Speichern der Änderungen');
        error.details = responseData.details;
        throw error;
      }

      setSuccess('Änderungen erfolgreich gespeichert');
      setTimeout(() => setSuccess(null), 3000);
      handleCloseDetail();
      await fetchMovies();
    } catch (err) {
      console.error('Detaillierter Fehler beim Speichern:', {
        message: err.message,
        details: err.details,
        error: err,
        rating: rating,
        movieId: editId,
        groupId: groupId
      });
      setError(`Fehler beim Speichern: ${err.message}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleAddTag = (tag) => {
    if (!tag) return;
    if (tags.some(t => t.label === tag.label)) return;
    setTags([...tags, { label: tag.label, color: tag.color }]);
    setTagInput('');
  };

  // Gefilterte Filme
  const filteredMovies = useMemo(() => {
    return movies.filter(movie => {
      // Status-Filter
      if (filterStatus.length > 0 && !filterStatus.includes(movie.status)) {
        return false;
      }

      // Tag-Filter
      if (filterTags.length > 0) {
        const movieTags = Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []);
        const hasMatchingTag = filterTags.some(filterTag =>
          movieTags.some(movieTag => movieTag.label === filterTag.label)
        );
        if (!hasMatchingTag) return false;
      }

      // Suche
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = (movie.title || '').toLowerCase().includes(searchLower);
        const tagsMatch = (Array.isArray(movie.tags) ? movie.tags : []).some(
          tag => tag.label.toLowerCase().includes(searchLower)
        );
        if (!titleMatch && !tagsMatch) return false;
      }

      return true;
    });
  }, [movies, filterStatus, filterTags, searchTerm]);

  // Lade Freundesliste
  const loadFriends = async () => {
    try {
      console.log('[GroupWatchlist] Loading friends list');
      const response = await fetch('http://localhost:8000/api/friends/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Fehler beim Laden der Freunde');
      const data = await response.json();
      console.log('[GroupWatchlist] Loaded friends:', data);
      setFriendsWithWatchlist(data);
    } catch (err) {
      console.error('[GroupWatchlist] Error loading friends:', err);
      setError('Fehler beim Laden der Freundesliste: ' + err.message);
    }
  };

  // Mitglied hinzufügen (Einladung senden)
  const inviteMember = async (username) => {
    try {
      console.log(`[GroupWatchlist] Inviting member ${username} to group ${groupId}`);
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Einladen des Mitglieds');
      }

      console.log('[GroupWatchlist] Successfully invited member');
      setSuccess('Einladung erfolgreich gesendet');
      await loadGroupData();
    } catch (err) {
      console.error('[GroupWatchlist] Error inviting member:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Lade Gruppeninformationen
  const loadGroupData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`[GroupWatchlist] Loading group data for group ${groupId}`);
      
      // Prüfe zuerst den Mitgliedschaftsstatus
      const statusResponse = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/membership-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!statusResponse.ok) {
        const errorData = await statusResponse.json();
        console.error('[GroupWatchlist] Status response error:', errorData);
        
        if (statusResponse.status === 404) {
          setError('Diese Gruppe existiert nicht.');
          setTimeout(() => navigate('/dashboard'), 2000);
          return;
        }
        throw new Error(errorData.error || 'Fehler beim Laden des Mitgliedschaftsstatus');
      }
      
      const statusData = await statusResponse.json();
      console.log('[GroupWatchlist] Membership status:', statusData);
      
      if (statusData.status === 'pending') {
        setHasPendingInvite(true);
        setLoading(false);
        return;
      } else if (statusData.status === 'not_member') {
        setError('Du hast keine Berechtigung für diese Gruppe.');
        setTimeout(() => navigate('/dashboard'), 2000);
        return;
      }

      // Wenn Mitglied, lade Gruppeninformationen
      const [groupResponse, membersResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/watchlist/groups/${groupId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (!groupResponse.ok) {
        const errorData = await groupResponse.json();
        console.error('[GroupWatchlist] Group data response error:', errorData);
        throw new Error(errorData.error || 'Fehler beim Laden der Gruppe');
      }
      
      const [groupData, membersData] = await Promise.all([
        groupResponse.json(),
        membersResponse.json()
      ]);
      
      console.log('[GroupWatchlist] Group data loaded:', groupData);
      setGroup(groupData);
      setMembers(membersData);
      
      setLoading(false);
    } catch (err) {
      console.error('[GroupWatchlist] Error in loadGroupData:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(45deg, #0a1929 30%, #1a2027 90%)'
      }}>
        <CircularProgress sx={{ color: '#00ff9d' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (hasPendingInvite) {
    return (
      <Box sx={{ 
        p: 3, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 2,
        maxWidth: 600,
        margin: '0 auto',
        mt: 4
      }}>
        <Paper sx={{ 
          p: 3, 
          width: '100%',
          bgcolor: 'rgba(0,255,157,0.05)',
          border: '1px solid rgba(0,255,157,0.1)',
          borderRadius: 2
        }}>
          <Typography variant="h5" gutterBottom sx={{ color: '#00ff9d' }}>
            Einladung zur Gruppen-Watchlist
          </Typography>
          <Typography sx={{ mb: 3, color: '#fff' }}>
            Du wurdest zu dieser Gruppen-Watchlist eingeladen. Möchtest du der Gruppe beitreten?
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button 
              variant="outlined" 
              color="error" 
              onClick={() => handleRejectInvite(groupId)}
              disabled={loading}
            >
              Ablehnen
            </Button>
            <Button 
              variant="contained" 
              sx={{ 
                bgcolor: '#00ff9d',
                '&:hover': { bgcolor: '#00cc7d' }
              }} 
              onClick={() => handleAcceptInvite(groupId)}
              disabled={loading}
            >
              Beitreten
            </Button>
          </Box>
        </Paper>
        {success && (
          <Alert severity="success" sx={{ width: '100%' }}>
            {success}
          </Alert>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{
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
    }}>
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <GroupWatchlistHeader
          groupName={group?.name}
          username={username}
          navigate={navigate}
          setSettingsOpen={setSettingsOpen}
          groupId={groupId}
        />

        <GroupWatchlistSearch
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          fetchMovies={fetchMovies}
          setFilterOpen={setFilterOpen}
          filterStatus={filterStatus}
          filterTags={filterTags}
        />

        {/* Success Message */}
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

          {filteredMovies.length === 0 ? (
            <Typography sx={{ color: '#fff', textAlign: 'center' }}>
              Keine Einträge gefunden.
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
                    isGroupWatchlist={true}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

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
          hidePrivateSwitch={true}
          isGroupWatchlist={true}
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

        <GroupWatchlistSettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          group={group}
          members={members}
          onSave={loadGroups}
          isAdmin={group?.creator_username === username}
        />
      </Container>
    </Box>
  );
};

export default GroupWatchlist; 