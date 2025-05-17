import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import {
  Person as PersonIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../config';
import MatchView from './MatchView';

const MatchesList = () => {
  const [matches, setMatches] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  // Daten laden
  const loadData = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Du bist nicht eingeloggt');
        setLoading(false);
        return;
      }
      
      // Aktive Matches laden
      const matchesResponse = await axios.get(`${API_URL}/api/match/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Empfangene Einladungen laden
      const invitationsResponse = await axios.get(`${API_URL}/api/match/invites/received`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Gesendete Einladungen laden
      const sentInvitationsResponse = await axios.get(`${API_URL}/api/match/invites/sent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMatches(matchesResponse.data);
      setInvitations(invitationsResponse.data);
      setSentInvitations(sentInvitationsResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Matches:', error);
      setError('Fehler beim Laden der Matches');
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  // Einladung annehmen
  const handleAccept = async (invitationId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_URL}/api/match/invite/respond`,
        {
          invitation_id: invitationId,
          accept: true
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Neue Daten laden
      loadData();
      
      // Zum neuen Match navigieren
      if (response.data.match_id) {
        setSelectedMatch(response.data.match_id);
      }
    } catch (error) {
      console.error('Fehler beim Annehmen der Einladung:', error);
      setError('Fehler beim Annehmen der Einladung');
    }
  };
  
  // Einladung ablehnen
  const handleDecline = async (invitationId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API_URL}/api/match/invite/respond`,
        {
          invitation_id: invitationId,
          accept: false
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Neue Daten laden
      loadData();
    } catch (error) {
      console.error('Fehler beim Ablehnen der Einladung:', error);
      setError('Fehler beim Ablehnen der Einladung');
    }
  };
  
  // Einladung zurückziehen
  const handleCancel = async (invitationId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${API_URL}/api/match/invite/cancel`,
        {
          invitation_id: invitationId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Neue Daten laden
      loadData();
    } catch (error) {
      console.error('Fehler beim Zurückziehen der Einladung:', error);
      setError('Fehler beim Zurückziehen der Einladung');
    }
  };
  
  // Match löschen
  const handleDeleteMatch = async (matchId) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.delete(`${API_URL}/api/match/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Neue Daten laden
      loadData();
    } catch (error) {
      console.error('Fehler beim Löschen des Matches:', error);
      setError('Fehler beim Löschen des Matches');
    }
  };
  
  if (selectedMatch) {
    return (
      <MatchView 
        matchId={selectedMatch} 
        onBack={() => {
          setSelectedMatch(null);
          loadData();
        }} 
      />
    );
  }
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 2, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Deine Matches
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      
      {/* Empfangene Einladungen */}
      {invitations.length > 0 && (
        <Paper elevation={2} sx={{ mb: 4, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Einladungen ({invitations.length})
          </Typography>
          
          <List>
            {invitations.map(invitation => (
              <React.Fragment key={invitation.id}>
                <ListItem 
                  secondaryAction={
                    <Box>
                      <Button 
                        variant="outlined" 
                        color="error"
                        size="small"
                        onClick={() => handleDecline(invitation.id)}
                        sx={{ mr: 1 }}
                      >
                        Ablehnen
                      </Button>
                      <Button 
                        variant="contained" 
                        color="primary"
                        size="small"
                        onClick={() => handleAccept(invitation.id)}
                      >
                        Annehmen
                      </Button>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={invitation.sender_username} 
                    secondary="lädt dich zu einem Match ein"
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
      
      {/* Gesendete Einladungen */}
      {sentInvitations.length > 0 && (
        <Paper elevation={2} sx={{ mb: 4, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Gesendete Einladungen ({sentInvitations.length})
          </Typography>
          
          <List>
            {sentInvitations.map(invitation => (
              <React.Fragment key={invitation.id}>
                <ListItem 
                  secondaryAction={
                    <Button 
                      variant="outlined" 
                      color="error"
                      size="small"
                      onClick={() => handleCancel(invitation.id)}
                    >
                      Zurückziehen
                    </Button>
                  }
                >
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={invitation.receiver_username} 
                    secondary="Warte auf Antwort..."
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
      
      {/* Aktive Matches */}
      {matches.length > 0 ? (
        <Paper elevation={3} sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Aktive Matches ({matches.length})
          </Typography>
          
          <List>
            {matches.map(match => (
              <React.Fragment key={match.id}>
                <ListItem 
                  sx={{ 
                    backgroundColor: match.status === 'active' ? 'rgba(46, 125, 50, 0.1)' : undefined,
                    borderRadius: 1
                  }}
                  secondaryAction={
                    <Box>
                      <Button 
                        variant="outlined" 
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteMatch(match.id)}
                        sx={{ mr: 1 }}
                      >
                        Löschen
                      </Button>
                      <Button 
                        variant="contained" 
                        color="primary"
                        size="small"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => setSelectedMatch(match.id)}
                      >
                        Öffnen
                      </Button>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={`Match mit ${
                      match.player1_username === localStorage.getItem('username') 
                        ? match.player2_username 
                        : match.player1_username
                    }`} 
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip 
                          label={match.status === 'lobby' ? 'Lobby' : match.status === 'active' ? 'Aktiv' : match.status} 
                          size="small"
                          color={match.status === 'active' ? 'success' : 'default'}
                          sx={{ mr: 1 }}
                        />
                        {new Date(match.updated_at).toLocaleString()}
                      </Box>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Du hast noch keine aktiven Matches.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Lade Freunde zu einem Match ein, um gemeinsam Filme auszuwählen!
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default MatchesList; 