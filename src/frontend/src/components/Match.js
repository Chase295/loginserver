import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Grid,
  Alert
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardIcon from '@mui/icons-material/Dashboard';

const Match = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [receivedInvites, setReceivedInvites] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Token aus dem Local Storage holen
  const token = localStorage.getItem('token');
  
  // Wenn kein Token vorhanden ist, zur Login-Seite weiterleiten
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // Daten laden
  const loadData = async () => {
    try {
      // Freunde laden
      const friendsResponse = await fetch('/api/match/friends', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!friendsResponse.ok) {
        throw new Error('Fehler beim Laden der Freunde');
      }
      
      const friendsData = await friendsResponse.json();
      setFriends(friendsData);

      // Gesendete Einladungen laden
      const sentInvitesResponse = await fetch('/api/match/invites/sent', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!sentInvitesResponse.ok) {
        throw new Error('Fehler beim Laden der gesendeten Einladungen');
      }
      
      const sentInvitesData = await sentInvitesResponse.json();
      setSentInvites(sentInvitesData);

      // Empfangene Einladungen laden
      const receivedInvitesResponse = await fetch('/api/match/invites/received', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!receivedInvitesResponse.ok) {
        throw new Error('Fehler beim Laden der empfangenen Einladungen');
      }
      
      const receivedInvitesData = await receivedInvitesResponse.json();
      setReceivedInvites(receivedInvitesData);

      // Aktive Matches laden
      const activeMatchesResponse = await fetch('/api/match/active', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!activeMatchesResponse.ok) {
        throw new Error('Fehler beim Laden der aktiven Matches');
      }
      
      const activeMatchesData = await activeMatchesResponse.json();
      setActiveMatches(activeMatchesData);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // Match-Einladung senden
  const sendMatchInvite = async (friendId) => {
    try {
      const response = await fetch('/api/match/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ receiver_id: friendId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Senden der Einladung');
      }
      
      setSuccess('Einladung erfolgreich gesendet!');
      
      // Daten neu laden
      loadData();
      
      // Erfolgs-Nachricht nach 3 Sekunden ausblenden
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
      
      // Fehler-Nachricht nach 3 Sekunden ausblenden
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  // Match-Einladung zurückziehen
  const cancelMatchInvite = async (invitationId) => {
    try {
      const response = await fetch('/api/match/invite/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invitation_id: invitationId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Zurückziehen der Einladung');
      }
      
      setSuccess('Einladung zurückgezogen!');
      
      // Daten neu laden
      loadData();
      
      // Erfolgs-Nachricht nach 3 Sekunden ausblenden
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
      
      // Fehler-Nachricht nach 3 Sekunden ausblenden
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  // Match-Einladung annehmen oder ablehnen
  const respondToInvite = async (invitationId, accept) => {
    try {
      const response = await fetch('/api/match/invite/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invitation_id: invitationId, accept })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Beantworten der Einladung');
      }
      
      setSuccess(accept ? 'Einladung angenommen!' : 'Einladung abgelehnt!');
      
      // Bei Annahme zur Match-Lobby weiterleiten
      if (accept && data.match_id) {
        navigate(`/match-lobby/${data.match_id}`);
        return;
      }
      
      // Daten neu laden
      loadData();
      
      // Erfolgs-Nachricht nach 3 Sekunden ausblenden
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
      
      // Fehler-Nachricht nach 3 Sekunden ausblenden
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  // Zum Match navigieren
  const goToMatch = (matchId) => {
    navigate(`/match-lobby/${matchId}`);
  };

  // Zurück zum Dashboard
  const goToDashboard = () => {
    navigate('/dashboard');
  };

  // Prüfen ob ein Freund bereits eingeladen wurde
  const isInvited = (friendId) => {
    return sentInvites.some(invite => invite.receiver_id === friendId);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Match
        </Typography>
        <Button 
          variant="outlined" 
          startIcon={<DashboardIcon />} 
          onClick={goToDashboard}
        >
          Dashboard
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Linke Spalte: Freunde und Herausfordern */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Freunde herausfordern
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {friends.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Du hast noch keine Freunde. Füge Freunde hinzu, um sie zu einem Match herauszufordern.
              </Typography>
            ) : (
              <List>
                {friends.map((friend) => (
                  <ListItem
                    key={friend.friend_id}
                    secondaryAction={
                      isInvited(friend.friend_id) ? (
                        <Tooltip title="Einladung zurückziehen">
                          <IconButton 
                            edge="end" 
                            color="error"
                            onClick={() => {
                              const invite = sentInvites.find(inv => inv.receiver_id === friend.friend_id);
                              if (invite) {
                                cancelMatchInvite(invite.id);
                              }
                            }}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Zum Match herausfordern">
                          <IconButton 
                            edge="end" 
                            color="primary"
                            onClick={() => sendMatchInvite(friend.friend_id)}
                          >
                            <SportsKabaddiIcon />
                          </IconButton>
                        </Tooltip>
                      )
                    }
                  >
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText primary={friend.friend_username} />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Gesendete Einladungen
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {sentInvites.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Du hast keine Einladungen gesendet.
              </Typography>
            ) : (
              <List>
                {sentInvites.map((invite) => (
                  <ListItem
                    key={invite.id}
                    secondaryAction={
                      <Tooltip title="Einladung zurückziehen">
                        <IconButton 
                          edge="end" 
                          color="error"
                          onClick={() => cancelMatchInvite(invite.id)}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={invite.receiver_username} 
                      secondary="Warten auf Antwort..." 
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Rechte Spalte: Einladungen und aktive Matches */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Erhaltene Einladungen
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {receivedInvites.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Du hast keine Einladungen erhalten.
              </Typography>
            ) : (
              <List>
                {receivedInvites.map((invite) => (
                  <ListItem key={invite.id}>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={invite.sender_username} 
                      secondary="Fordert dich zu einem Match heraus!" 
                    />
                    <Tooltip title="Annehmen">
                      <IconButton 
                        color="success"
                        onClick={() => respondToInvite(invite.id, true)}
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ablehnen">
                      <IconButton 
                        color="error"
                        onClick={() => respondToInvite(invite.id, false)}
                      >
                        <CancelIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Aktive Matches
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {activeMatches.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Du hast keine aktiven Matches.
              </Typography>
            ) : (
              <List>
                {activeMatches.map((match) => (
                  <ListItem
                    key={match.id}
                    secondaryAction={
                      <Button 
                        variant="contained" 
                        size="small"
                        onClick={() => goToMatch(match.id)}
                      >
                        Beitreten
                      </Button>
                    }
                  >
                    <ListItemIcon>
                      <SportsKabaddiIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`Match gegen ${match.player1_username === localStorage.getItem('username') 
                        ? match.player2_username 
                        : match.player1_username}`} 
                      secondary={`Status: ${match.status === 'lobby' ? 'In der Lobby' : 'Aktiv'}`} 
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Match; 