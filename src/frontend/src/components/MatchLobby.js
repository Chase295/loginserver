import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  Grid,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Chip,
  Autocomplete,
  Rating
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CancelIcon from '@mui/icons-material/Cancel';
import FilterListIcon from '@mui/icons-material/FilterList';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

const MatchLobby = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const token = localStorage.getItem('token');
  const currentUsername = localStorage.getItem('username');
  
  const initialFilters = {
    privacy: 'all',
    status: [],
    tags: [],
    minRating: 0,
  };

  const [userWatchlist, setUserWatchlist] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [filteredWatchlist, setFilteredWatchlist] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const loadUserWatchlistAndTags = useCallback(async () => {
    if (!token) return;
    try {
      const wlResponse = await fetch('http://localhost:8000/api/watchlist/movies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!wlResponse.ok) throw new Error('Fehler beim Laden der Watchlist');
      const wlData = await wlResponse.json();
      setUserWatchlist(wlData);

      const tagsResponse = await fetch('http://localhost:8000/api/user/tags', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!tagsResponse.ok) throw new Error('Fehler beim Laden der Tags');
      const tagsData = await tagsResponse.json();
      setUserTags(tagsData);
    } catch (err) {
      setError(prevError => prevError ? `${prevError}; ${err.message}` : err.message);
    }
  }, [token]);
  
  const applyFilters = useCallback(() => {
    let tempFiltered = [...userWatchlist];

    if (filters.privacy === 'private') {
      tempFiltered = tempFiltered.filter(movie => movie.is_private === true);
    } else if (filters.privacy === 'public') {
      tempFiltered = tempFiltered.filter(movie => movie.is_private === false);
    }

    if (filters.status.length > 0) {
      tempFiltered = tempFiltered.filter(movie => filters.status.includes(movie.status));
    }

    if (filters.tags.length > 0) {
      const filterTagLabels = filters.tags.map(t => t.label);
      tempFiltered = tempFiltered.filter(movie => {
        const movieTags = movie.tags ? (Array.isArray(movie.tags) ? movie.tags : JSON.parse(movie.tags)) : [];
        const movieTagLabels = movieTags.map(t => t.label);
        return filterTagLabels.every(filterTag => movieTagLabels.includes(filterTag));
      });
    }

    if (filters.minRating > 0) {
      tempFiltered = tempFiltered.filter(movie => movie.rating && movie.rating >= filters.minRating);
    }

    setFilteredWatchlist(tempFiltered);
  }, [userWatchlist, filters]);

  const handlePrivacyChange = (newPrivacy) => {
    setFilters(prev => ({ ...prev, privacy: newPrivacy }));
  };

  const handleStatusToggle = (statusValue) => {
    setFilters(prev => {
      const newStatus = prev.status.includes(statusValue)
        ? prev.status.filter(s => s !== statusValue)
        : [...prev.status, statusValue];
      return { ...prev, status: newStatus };
    });
  };

  const loadMatchData = useCallback(async () => {
    if (!matchId || !token) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/match/${matchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorData = await response.text(); 
        console.error("Error loading match data:", errorData);
        try {
            const jsonData = JSON.parse(errorData);
            throw new Error(jsonData.error || 'Fehler beim Laden der Match-Daten');
        } catch (e) {
             throw new Error('Fehler beim Laden der Match-Daten - Server antwortete nicht mit JSON.');
        }
      }
      const matchData = await response.json();
      setMatch(matchData);
      
      // Prüfen, ob der aktuelle Spieler bereits als bereit markiert ist
      const isCurrentPlayerP1 = currentUsername === matchData.player1_username;
      const isCurrentPlayerP2 = currentUsername === matchData.player2_username;
      const isCurrentPlayerInMatch = isCurrentPlayerP1 || isCurrentPlayerP2;
      
      if (isCurrentPlayerInMatch) {
        if ((isCurrentPlayerP1 && matchData.player1_ready) || (isCurrentPlayerP2 && matchData.player2_ready)) {
          setIsReady(true);
        }
      }
      
      // Prüfen, ob das Match aktiv ist (beide Spieler bereit) und zur Game-Seite weiterleiten
      if (matchData.status === 'active') {
        navigate(`/match/${matchId}/game`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [matchId, token, navigate]);
  
  useEffect(() => {
    if (token && matchId) {
      loadMatchData();
      loadUserWatchlistAndTags();
      
      // Polling für Match-Status, um zu prüfen, ob der andere Spieler bereit ist
      const intervalId = setInterval(() => {
        loadMatchData();
      }, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [token, matchId, loadMatchData, loadUserWatchlistAndTags]);

  useEffect(() => {
    applyFilters();
  }, [filters, userWatchlist, applyFilters]);

  const updateMatchStatus = async (newStatus) => {
    try {
      const response = await fetch(`http://localhost:8000/api/match/${matchId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Aktualisieren des Match-Status');
      }
      setSuccess('Match-Status aktualisiert!');
      loadMatchData();
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  const markPlayerReady = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/match/${matchId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Markieren als bereit');
      }
      
      setIsReady(true);
      setSuccess('Du bist bereit! Warte auf deinen Mitspieler...');
      loadMatchData();
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  const cancelMatch = () => {
    updateMatchStatus('cancelled');
    navigate('/match');
  };

  const goBackToMatches = () => {
    navigate('/match');
  };

  const isPlayer1 = match && currentUsername === match.player1_username;
  const isPlayer2 = match && currentUsername === match.player2_username;
  const isCurrentUserInMatch = isPlayer1 || isPlayer2;

  // Prüfen, ob die Spieler bereit sind
  const isPlayer1Ready = match && match.player1_ready;
  const isPlayer2Ready = match && match.player2_ready;

  const resetFilters = () => {
      setFilters(initialFilters);
  }

  if (loading && !match) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress sx={{color: '#00ff9d'}} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
        <Alert severity="error">
          {error}
        </Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={goBackToMatches}
          sx={{ mt: 2 }}
        >
          Zurück zur Match-Übersicht
        </Button>
      </Box>
    );
  }

  if (!match) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
        <Alert severity="warning">
          Match nicht gefunden oder konnte nicht geladen werden.
        </Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={goBackToMatches}
          sx={{ mt: 2 }}
        >
          Zurück zur Match-Übersicht
        </Button>
      </Box>
    );
  }

  const renderPlayerCard = (playerUsernameForCard, playerRole) => {
    const isCurrentPlayerCard = currentUsername === playerUsernameForCard;
    const isPlayerReady = playerRole === 1 ? isPlayer1Ready : isPlayer2Ready;
    const statusButtonConfig = [
        { value: 'gesehen', label: 'Gesehen', emoji: '✅' },
        { value: 'läuft gerade', label: 'Am Schauen', emoji: '▶️' },
        { value: 'abgebrochen', label: 'Abgebrochen', emoji: '🛑' },
        { value: 'geplant', label: 'Watchlist', emoji: '🕒' },
    ];
    const privacyOptions = [
        { value: 'all', label: 'Alle Titel anzeigen', emoji: '🌍' },
        { value: 'public', label: 'Alle außer private', emoji: '👁️‍🗨️' },
        { value: 'private', label: 'Nur private Titel', emoji: '🔒' },
    ];

    return (
      <Grid item xs={12} md={isCurrentUserInMatch && showFilters ? 12 : 6} key={playerUsernameForCard}>
        <Paper 
          elevation={0} 
          sx={{
            p: 2.5,
            mb: 2, 
            bgcolor: isPlayerReady ? 'rgba(0,255,157,0.05)' : 'rgba(30, 41, 59, 0.5)',
            border: isCurrentPlayerCard ? '1px solid #00ff9d' : isPlayerReady ? '1px solid rgba(0,255,157,0.5)' : '1px solid rgba(71, 85, 105, 0.7)',
            borderRadius: '12px',
            backdropFilter: 'blur(5px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: isCurrentPlayerCard ? 2 : 1 }}>
            <Avatar sx={{ bgcolor: playerRole === 1 ? '#3b82f6' : '#f59e0b', color: '#fff', mr: 1.5, width: 32, height: 32, fontSize: '0.8rem' }}>
              {playerRole === 1 ? 'P1' : 'P2'}
            </Avatar>
            <Typography variant="h6" sx={{ color: '#e2e8f0', fontSize: '1.1rem' }}>
              {playerUsernameForCard}
            </Typography>
            {isCurrentPlayerCard && (
                 <Chip label="Das bist du" size="small" sx={{ ml: 'auto', bgcolor: '#00ff9d', color: '#000', height: '22px', fontSize: '0.7rem' }} />
            )}
            {!isCurrentPlayerCard && isPlayerReady && (
                <Chip 
                  icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important', color: '#00ff9d' }} />} 
                  label="Bereit" 
                  size="small" 
                  sx={{ ml: 'auto', bgcolor: 'rgba(0,255,157,0.1)', color: '#00ff9d', height: '22px', fontSize: '0.7rem', border: '1px solid rgba(0,255,157,0.5)' }} 
                />
            )}
          </Box>

          {isCurrentPlayerCard && (
            <>
              <Button
                fullWidth
                variant="text"
                startIcon={<FilterListIcon sx={{color: showFilters ? '#00ff9d' : '#94a3b8'}}/>}
                onClick={() => setShowFilters(prev => !prev)}
                sx={{
                  mb: showFilters ? 2 : 0,
                  justifyContent: 'flex-start',
                  color: showFilters ? '#00ff9d' : '#94a3b8', 
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  p: '6px 8px',
                  '&:hover': {
                    backgroundColor: 'rgba(0,255,157,0.05)'
                  }
                }}
              >
                {showFilters ? 'Filter ausblenden' : 'Meine Filter definieren'}
              </Button>
              {showFilters && (
                <Box sx={{ pt: 1, borderTop: '1px solid rgba(71, 85, 105, 0.7)', mt:1.5 }}>
                  <Typography variant="overline" display="block" sx={{ color: '#94a3b8', mb: 1, fontSize: '0.7rem' }}>Privatsphäre</Typography>
                  <Grid container spacing={1} sx={{ mb: 2.5 }}>
                    {privacyOptions.map(opt => (
                        <Grid item xs={4} key={opt.value}>
                            <Button fullWidth onClick={() => handlePrivacyChange(opt.value)} sx={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', 
                                p:1, borderRadius: '8px', 
                                color: filters.privacy === opt.value ? '#00ff9d' : '#94a3b8',
                                bgcolor: filters.privacy === opt.value ? 'rgba(0,255,157,0.1)' : 'transparent',
                                border: `1px solid ${filters.privacy === opt.value ? '#00ff9d' : 'rgba(71, 85, 105, 0.7)'}`,
                                textTransform: 'none', fontSize: '0.7rem', lineHeight: '1.2',
                                '&:hover': { bgcolor: 'rgba(0,255,157,0.05)', borderColor: '#00ff9d'}
                            }}>
                                <span role="img" aria-label={opt.label} style={{fontSize: '1.2rem', marginBottom: '4px'}}>{opt.emoji}</span>
                                {opt.label}
                            </Button>
                        </Grid>
                    ))}
                  </Grid>

                  <Typography variant="overline" display="block" sx={{ color: '#94a3b8', mb: 1, fontSize: '0.7rem' }}>Status</Typography>
                  <Grid container spacing={1} sx={{ mb: 2.5 }}>
                    {statusButtonConfig.map(opt => (
                      <Grid item xs={6} sm={3} key={opt.value}>
                        <Button
                          fullWidth
                          onClick={() => handleStatusToggle(opt.value)}
                          sx={{
                            p: '6px 8px', borderRadius: '20px',
                            color: filters.status.includes(opt.value) ? '#000' : '#94a3b8',
                            bgcolor: filters.status.includes(opt.value) ? '#00ff9d' : 'rgba(71, 85, 105, 0.4)',
                            border: '1px solid transparent',
                            textTransform: 'none', fontSize: '0.8rem',
                            '&:hover': {
                                bgcolor: filters.status.includes(opt.value) ? '#00cc7d' : 'rgba(71, 85, 105, 0.6)',
                                border: `1px solid ${filters.status.includes(opt.value) ? '#00cc7d' : '#00ff9d'}`
                            }
                          }}
                        >
                          <span role="img" aria-label={opt.label} style={{marginRight: '6px'}}>{opt.emoji}</span>
                          {opt.label}
                        </Button>
                      </Grid>
                    ))}
                  </Grid>

                  <Typography variant="overline" display="block" sx={{ color: '#94a3b8', mb: 1, fontSize: '0.7rem' }}>Tags</Typography>
                  <Autocomplete
                    multiple
                    options={userTags}
                    getOptionLabel={(option) => option.label}
                    value={filters.tags}
                    onChange={(event, newValue) => {
                      setFilters(prev => ({ ...prev, tags: newValue }));
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option.label}
                          {...getTagProps({ index })}
                          sx={{ bgcolor: option.color, color: '#fff', height: '24px', fontSize: '0.75rem', mr:0.5, mb:0.5 }}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        placeholder={filters.tags.length === 0 ? "Alle Tags" : ""}
                        size="small"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '8px',
                                bgcolor: 'rgba(71, 85, 105, 0.4)',
                                '& fieldset': { borderColor: 'rgba(71, 85, 105, 0.7)' },
                                '&:hover fieldset': { borderColor: '#00ff9d' },
                                '&.Mui-focused fieldset': { borderColor: '#00ff9d' },
                                'input': { color: '#e2e8f0', fontSize: '0.9rem' },
                                '& .MuiAutocomplete-tag': { m: '2px'}
                            },
                            '& .MuiInputLabel-root.Mui-focused': {color: '#00ff9d'} 
                        }}
                      />
                    )}
                    PaperComponent={(props) => <Paper {...props} sx={{bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #00ff9d'}}/>}
                    sx={{ mb: 2.5 }}
                  />

                  <Typography variant="overline" display="block" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>Mindestbewertung</Typography>
                  <Rating
                    value={filters.minRating}
                    onChange={(event, newValue) => {
                      setFilters(prev => ({ ...prev, minRating: newValue === null ? 0 : newValue }));
                    }}
                    max={10} 
                    emptyIcon={<span style={{opacity:0.3, filter: 'grayscale(80%)'}}>⭐</span>}
                    icon={<span style={{textShadow: '0 0 5px #00ff9d'}}>⭐</span>}
                    sx={{ color: '#00ff9d', fontSize: '1.8rem'}}
                  />
                  
                  <Box sx={{display: 'flex', justifyContent:'flex-end', mt: 2.5, pt:1.5, borderTop: '1px solid rgba(71, 85, 105, 0.7)'}}>
                    <Button 
                        onClick={resetFilters} 
                        sx={{color: '#f87171', textTransform:'none', fontSize: '0.8rem', '&:hover': {bgcolor: 'rgba(248,113,113,0.1)'} }}
                    > 
                        Filter zurücksetzen
                    </Button>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: {xs: 1.5, sm: 2, md: 3}, maxWidth: 900, margin: '0 auto', color: '#e2e8f0' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={goBackToMatches} sx={{ mr: 1, color: '#00ff9d' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ color: '#e2e8f0' }}> 
            Match-Lobby
          </Typography>
        </Box>
        {match.status === 'lobby' && (
          <Button 
            variant="outlined" 
            startIcon={<CancelIcon />}
            onClick={cancelMatch}
            size="small"
            sx={{ color: '#f87171', borderColor: '#f87171', textTransform:'none', '&:hover': {borderColor: '#ef4444', backgroundColor: 'rgba(248,113,113,0.1)'} }}
          >
            Match abbrechen
          </Button>
        )}
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2, bgcolor: 'rgba(0,255,157,0.1)', color: '#00ff9d', border: '1px solid #00ff9d' }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={2}>
        {renderPlayerCard(match.player1_username, 1)}
        {renderPlayerCard(match.player2_username, 2)}
        
        {isCurrentUserInMatch && showFilters && (
          <Grid item xs={12}>
            <Paper 
              elevation={0}
              sx={{
                p:2, 
                mt: -1,
                bgcolor: 'rgba(30, 41, 59, 0.5)', 
                border: '1px solid rgba(71, 85, 105, 0.7)',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px',
                backdropFilter: 'blur(5px)',
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d', fontSize: '1rem', mb: 1.5 }}>
                Meine gefilterten Titel ({filteredWatchlist.length})
              </Typography>
              {filteredWatchlist.length > 0 ? (
                <List dense sx={{maxHeight: 280, overflow: 'auto', p:0}}>
                  {filteredWatchlist.map(movie => (
                    <ListItem 
                      key={movie.id} 
                      sx={{
                          borderBottom: '1px solid rgba(71, 85, 105, 0.5)', 
                          mb:0.5, 
                          p: '8px 4px',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s ease',
                          '&:last-child': { borderBottom: 'none' },
                          '&:hover': { bgcolor: 'rgba(71, 85, 105, 0.3)'}
                      }}
                    >
                      <ListItemAvatar sx={{minWidth: 50}}>
                          <Avatar variant="rounded" src={movie.poster_url || undefined} alt={movie.title} sx={{bgcolor: 'transparent', width: 36, height: 54}}>
                             {!movie.poster_url && <SportsKabaddiIcon sx={{color: '#64748b', fontSize: '1.8rem'}}/>}
                          </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                          primaryTypographyProps={{style:{color:'#e2e8f0', fontSize: '0.9rem', fontWeight: 500}}}
                          secondaryTypographyProps={{style:{color:'#94a3b8', fontSize: '0.75rem'}}}
                          primary={movie.title} 
                          secondary={`Jahr: ${movie.year || '-'} | Status: ${movie.status || '-'} | Rating: ${movie.rating ? movie.rating+'⭐' : '-'}`} 
                      />
                    </ListItem>
                  ))}
                </List>
                ) : (
                    <Typography sx={{color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', py:2}}>
                        Keine Titel entsprechen deinen Filtern.
                    </Typography>
                )
              }
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Bereit-Button für beide Spieler, wenn sie im Match sind */}
      {isCurrentUserInMatch && match.status === 'lobby' && (
         <Box sx={{display: 'flex', justifyContent: 'center', mt:3}}>
            <Button 
                variant="contained" 
                startIcon={isReady ? <CheckCircleIcon /> : <PlayArrowIcon />}
                onClick={markPlayerReady}
                disabled={isReady}
                sx={{ 
                    bgcolor: isReady ? 'rgba(0,255,157,0.3)' : '#00ff9d', 
                    color: isReady ? 'rgba(0,0,0,0.7)' : '#000', 
                    fontSize: '1rem', 
                    px: 4, 
                    py: 1,
                    '&:hover': {bgcolor: '#00cc7d'},
                    '&.Mui-disabled': {bgcolor: 'rgba(0,255,157,0.3)', color: 'rgba(0,0,0,0.7)'}
                }}
            >
                {isReady 
                  ? 'Du bist bereit' 
                  : 'Ich bin bereit'}
            </Button>
        </Box>
      )}

      {/* Anzeige des Match-Status, wenn mindestens ein Spieler bereit ist */}
      {isCurrentUserInMatch && match.status === 'lobby' && (isPlayer1Ready || isPlayer2Ready) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2 }}>
          <HourglassEmptyIcon sx={{ color: '#00ff9d', mr: 1, fontSize: '1.2rem' }} />
          <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            {isPlayer1Ready && isPlayer2Ready 
              ? 'Beide Spieler sind bereit. Starte Match...' 
              : `Warte auf ${isPlayer1Ready ? match.player2_username : match.player1_username}...`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MatchLobby; 