import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Alert,
  Paper,
  Grid,
  Chip,
  TextField,
  CircularProgress
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import AddIcon from '@mui/icons-material/Add';

const MultiplayerDialog = ({
  open,
  setMultiplayerOpen,
  friendsWithWatchlist,
  navigate
}) => {
  const [privacyMap, setPrivacyMap] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  
  // Match-bezogene States
  const [sentInvites, setSentInvites] = useState([]);
  const [receivedInvites, setReceivedInvites] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Gruppen-Watchlisten States
  const [groupWatchlists, setGroupWatchlists] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Token aus dem Local Storage holen
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');

  // Gruppen-Watchlisten laden
  const loadGroupWatchlists = async () => {
    if (!token || activeTab !== 2) return;
    setLoadingGroups(true);
    setError(null);
    
    try {
      console.log('[MultiplayerDialog] Loading group watchlists');
      
      const response = await fetch('http://localhost:8000/api/watchlist/groups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Laden der Gruppen-Watchlisten');
      }
      
      const data = await response.json();
      console.log('[MultiplayerDialog] Loaded groups data:', {
        hasAccepted: Array.isArray(data.accepted),
        acceptedLength: data.accepted?.length || 0,
        hasPending: Array.isArray(data.pending),
        pendingLength: data.pending?.length || 0
      });
      
      if (!data.accepted || !data.pending) {
        console.error('[MultiplayerDialog] Invalid data structure:', data);
        throw new Error('Ungültiges Datenformat von der API');
      }
      
      setGroupWatchlists(data);
    } catch (err) {
      console.error('[MultiplayerDialog] Error loading groups:', err);
      setError(err.message);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Neue Gruppe erstellen
  const createGroupWatchlist = async () => {
    if (!newGroupName.trim()) {
      setError('Bitte gib einen Gruppennamen ein');
      return;
    }
    setIsCreatingGroup(true);
    try {
      const response = await fetch('http://localhost:8000/api/watchlist/groups', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newGroupName.trim() })
      });
      if (!response.ok) throw new Error('Fehler beim Erstellen der Gruppe');
      setSuccess('Gruppe erfolgreich erstellt!');
      setNewGroupName('');
      loadGroupWatchlists();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Gruppe löschen
  const deleteGroupWatchlist = async (groupId) => {
    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Fehler beim Löschen der Gruppe');
      setSuccess('Gruppe erfolgreich gelöscht!');
      // Sofort die Gruppenliste neu laden
      await loadGroupWatchlists();
    } catch (err) {
      setError(err.message);
    }
  };

  // Effekt zum Neuladen der Gruppenliste wenn der Dialog geöffnet wird
  useEffect(() => {
    if (open) {
      loadGroupWatchlists();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fetchPrivacy = async () => {
      const token = localStorage.getItem('token');
      const map = {};
      await Promise.all(friendsWithWatchlist.map(async (friend) => {
        try {
          const uname = friend.friend_username || friend.username;
          const res = await fetch(`http://localhost:8000/api/watchlist/visibility/${uname}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            map[uname] = data.watchlist_visibility;
          } else {
            map[uname] = 'unknown';
          }
        } catch {
          map[friend.friend_username || friend.username] = 'unknown';
        }
      }));
      setPrivacyMap(map);
    };
    fetchPrivacy();
  }, [open, friendsWithWatchlist]);

  // Match-bezogene Daten laden
  useEffect(() => {
    if (!open || activeTab !== 1) return;
    loadMatchData();
  }, [open, activeTab]);

  // Gruppen-Watchlisten laden
  useEffect(() => {
    if (!open || activeTab !== 2) return;
    loadGroupWatchlists();
  }, [open, activeTab]);

  // Polling für Matchdaten
  useEffect(() => {
    if (!open || activeTab !== 1) return;
    const interval = setInterval(() => {
      loadMatchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [open, activeTab]);

  // Match-Daten laden
  const loadMatchData = async () => {
    try {
      setError(null);
      const sentInvitesResponse = await fetch('http://localhost:8000/api/match/invites/sent', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!sentInvitesResponse.ok) {
        throw new Error('Fehler beim Laden der gesendeten Einladungen');
      }
      const sentInvitesData = await sentInvitesResponse.json();
      setSentInvites(sentInvitesData);

      const receivedInvitesResponse = await fetch('http://localhost:8000/api/match/invites/received', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!receivedInvitesResponse.ok) {
        throw new Error('Fehler beim Laden der empfangenen Einladungen');
      }
      const receivedInvitesData = await receivedInvitesResponse.json();
      setReceivedInvites(receivedInvitesData);

      const activeMatchesResponse = await fetch('http://localhost:8000/api/match/active', {
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

  // Match-Einladung senden
  const sendMatchInvite = async (receiverId) => {
    try {
      // Sicherheitscheck: Prüfe erneut, ob mit diesem Benutzer bereits ein Match existiert
      const receiverUsername = friendsWithWatchlist.find(f => f.friend_user_id == receiverId)?.friend_username;
      if (activeMatchUsernames.includes(receiverUsername)) {
        setError(`Du hast bereits ein aktives Match mit ${receiverUsername}.`);
        return;
      }

      setError(null);
      const response = await fetch('http://localhost:8000/api/match/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ receiver_id: receiverId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Senden der Einladung');
      }
      setSuccess('Einladung erfolgreich gesendet!');
      loadMatchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Match-Einladung zurückziehen
  const cancelMatchInvite = async (invitationId) => {
    try {
      setError(null);
      const response = await fetch('http://localhost:8000/api/match/invite/cancel', {
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
      loadMatchData();
      
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
      setError(null);
      const response = await fetch('http://localhost:8000/api/match/invite/respond', {
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
      
      // Bei Annahme zur Match-Lobby weiterleiten und Dialog schließen
      if (accept && data.match_id) {
        setMultiplayerOpen(false);
        navigate(`/match-lobby/${data.match_id}`);
        return;
      }
      
      // Daten neu laden
      loadMatchData();
      
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
    setMultiplayerOpen(false);
    navigate(`/match-lobby/${matchId}`);
  };

  // Prüfen ob ein Freund bereits eingeladen wurde
  const isInvited = (uname) => {
    // Suche nach Einladung an diesen Usernamen
    return sentInvites.some(invite => invite.receiver_username === uname);
  };

  // Match löschen
  const deleteMatch = async (matchId) => {
    try {
      setError(null);
      const response = await fetch(`http://localhost:8000/api/match/${matchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen des Matches');
      }
      setSuccess('Match erfolgreich gelöscht!');
      loadMatchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  // IDs der Freunde, mit denen bereits ein aktives Match besteht
  const activeMatchUsernames = activeMatches
    .map(match => {
      const myUsername = localStorage.getItem('username');
      
      // Logging zur Fehlerbehebung
      console.log(`Aktives Match: ${match.id}, Player1: ${match.player1_username}, Player2: ${match.player2_username}, Ich bin: ${myUsername}`);
      
      // Finde den Benutzernamen des Gegners
      if (match.player1_username === myUsername) {
        console.log(`Als Player1: ${match.player2_username} ist mein Gegner`);
        return match.player2_username;
      }
      if (match.player2_username === myUsername) {
        console.log(`Als Player2: ${match.player1_username} ist mein Gegner`);
        return match.player1_username;
      }
      return null;
    })
    .filter(Boolean);

  if (activeMatches.length > 0) {
    console.log('Aktive Matches:', activeMatches);
    console.log('Aktive Match Usernames:', activeMatchUsernames);
  }

  // Gruppen-Einladung annehmen
  const handleAcceptInvite = async (groupId) => {
    if (!groupId) {
      console.error('[MultiplayerDialog] Invalid group ID for accept invite');
      setError('Ungültige Gruppeninformation');
      return;
    }
    
    try {
      setError(null);
      console.log(`[MultiplayerDialog] Accepting group invite for group ${groupId}`);
      
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/invites/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('[MultiplayerDialog] Accept invite response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Annehmen der Einladung');
      }

      setSuccess('Einladung erfolgreich angenommen');
      // Gruppen neu laden
      await loadGroupWatchlists();
      
      // Nach erfolgreicher Annahme zur Gruppe navigieren
      navigate(`/group-watchlist/${groupId}`);
      setMultiplayerOpen(false);
    } catch (err) {
      console.error('[MultiplayerDialog] Error accepting invite:', err);
      setError(err.message);
    }
  };

  // Gruppen-Einladung ablehnen
  const handleRejectInvite = async (groupId) => {
    if (!groupId) {
      console.error('[MultiplayerDialog] Invalid group ID for reject invite');
      setError('Ungültige Gruppeninformation');
      return;
    }
    
    try {
      setError(null);
      console.log(`[MultiplayerDialog] Rejecting group invite for group ${groupId}`);
      
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/invites/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('[MultiplayerDialog] Reject invite response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Ablehnen der Einladung');
      }

      setSuccess('Einladung abgelehnt');
      // Gruppen neu laden
      await loadGroupWatchlists();
    } catch (err) {
      console.error('[MultiplayerDialog] Error rejecting invite:', err);
      setError(err.message);
    }
  };

  return (
    <Dialog open={open} onClose={() => setMultiplayerOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0a1929', color: '#00ff9d', fontWeight: 700, textAlign: 'center' }}>
        Multiplayer: Deine Freunde
      </DialogTitle>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ bgcolor: '#1a2233', color: '#00ff9d', px: 2, mb: 1 }}
        centered
      >
        <Tab label="Watchliste" sx={{ color: activeTab === 0 ? '#00ff9d' : '#fff', fontWeight: 700 }} />
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>Match</span>
              <Chip 
                label="Beta" 
                size="small" 
                sx={{ 
                  bgcolor: 'rgba(255, 0, 255, 0.3)', 
                  color: '#ff00ff',
                  height: '20px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold'
                }} 
              />
            </Box>
          }
          sx={{ color: activeTab === 1 ? '#00ff9d' : '#fff', fontWeight: 700 }} 
        />
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>Gruppen Watchlisten</span>
              <Chip 
                label="Beta" 
                size="small" 
                sx={{ 
                  bgcolor: 'rgba(255, 0, 255, 0.3)', 
                  color: '#ff00ff',
                  height: '20px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold'
                }} 
              />
            </Box>
          }
          sx={{ color: activeTab === 2 ? '#00ff9d' : '#fff', fontWeight: 700 }} 
        />
      </Tabs>
      <DialogContent sx={{ bgcolor: '#1a2233', color: '#fff', p: 4 }}>
        {activeTab === 0 ? (
          friendsWithWatchlist.length === 0 ? (
            <Typography sx={{ color: '#fff', textAlign: 'center' }}>Du hast noch keine Freunde.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {friendsWithWatchlist.map(friend => {
                const uname = friend.friend_username || friend.username || friend.id;
                const isPrivate = privacyMap[uname] === 'private';
                return (
                  <Box
                    key={uname}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'rgba(0,255,157,0.07)',
                      cursor: isPrivate ? 'default' : 'pointer',
                      opacity: isPrivate ? 0.7 : 1,
                      transition: 'background 0.2s',
                      '&:hover': isPrivate ? {} : { bgcolor: 'rgba(0,255,157,0.18)' }
                    }}
                    onClick={() => {
                      if (!isPrivate) navigate(`/watchlist/${uname}`);
                    }}
                  >
                    <GroupIcon sx={{ color: isPrivate ? '#ff0062' : '#00ff9d' }} />
                    <Typography sx={{ color: isPrivate ? '#ff0062' : '#fff', fontWeight: 600, flex: 1 }}>{uname}</Typography>
                    {isPrivate && (
                      <Tooltip title="Watchlist ist privat">
                        <LockIcon sx={{ color: '#ff0062', ml: 1 }} />
                      </Tooltip>
                    )}
                  </Box>
                );
              })}
            </Box>
          )
        ) : activeTab === 1 ? (
          <Box>
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

            <Grid container spacing={2}>
              {/* Freunde und Herausfordern */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0,255,157,0.07)' }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d' }}>
                    Freunde herausfordern
                  </Typography>
                  <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                  
                  {(() => {
                    const myUsername = localStorage.getItem('username');
                    const matchUsernames = activeMatches.map(match => 
                      match.player1_username === myUsername ? match.player2_username : match.player1_username
                    );
                    
                    const availableFriends = friendsWithWatchlist.filter(friend => {
                      const friendUsername = friend.friend_username || friend.username;
                      return !matchUsernames.includes(friendUsername);
                    });
                    
                    if (availableFriends.length === 0) {
                      return (
                        <Typography variant="body2" sx={{ color: '#aaa' }}>
                          Du hast aktuell keine Freunde, die du herausfordern kannst. (Mit allen läuft bereits ein Match)
                        </Typography>
                      );
                    }
                    
                    return (
                      <List sx={{ p: 0 }}>
                        {availableFriends.map((friend) => {
                          const uname = friend.friend_username || friend.username || friend.id;
                          return (
                            <ListItem
                              key={uname}
                              sx={{ borderRadius: 1, mb: 1, bgcolor: 'rgba(0,0,0,0.2)' }}
                              secondaryAction={
                                isInvited(uname) ? (
                                  <Tooltip title="Einladung zurückziehen">
                                    <IconButton 
                                      edge="end" 
                                      sx={{ color: '#ff0062' }}
                                      onClick={() => {
                                        const invite = sentInvites.find(inv => inv.receiver_username === uname);
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
                                      sx={{ color: '#00ff9d' }}
                                      onClick={() => sendMatchInvite(friend.friend_user_id)}
                                    >
                                      <SportsKabaddiIcon />
                                    </IconButton>
                                  </Tooltip>
                                )
                              }
                            >
                              <ListItemIcon>
                                <PersonIcon sx={{ color: '#fff' }} />
                              </ListItemIcon>
                              <ListItemText 
                                primary={<Typography sx={{ color: '#fff' }}>{uname}</Typography>} 
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    );
                  })()}
                </Paper>
              </Grid>

              {/* Erhaltene Einladungen */}
              {receivedInvites.length > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,0,98,0.07)' }}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#ff0062' }}>
                      Erhaltene Einladungen
                    </Typography>
                    <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                    
                    <List sx={{ p: 0 }}>
                      {receivedInvites.map((invite) => (
                        <ListItem 
                          key={invite.id}
                          sx={{ 
                            borderRadius: 1, 
                            mb: 1,
                            bgcolor: 'rgba(0,0,0,0.2)'
                          }}
                        >
                          <ListItemIcon>
                            <PersonIcon sx={{ color: '#fff' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={<Typography sx={{ color: '#fff' }}>{invite.sender_username}</Typography>}
                            secondary={<Typography sx={{ color: '#aaa', fontSize: '0.8rem' }}>Fordert dich heraus!</Typography>}
                          />
                          <Tooltip title="Annehmen">
                            <IconButton 
                              sx={{ color: '#00ff9d', ml: 1 }}
                              onClick={() => respondToInvite(invite.id, true)}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Ablehnen">
                            <IconButton 
                              sx={{ color: '#ff0062' }}
                              onClick={() => respondToInvite(invite.id, false)}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              )}

              {/* Aktive Matches */}
              {activeMatches.length > 0 && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 2, bgcolor: 'rgba(0,255,157,0.07)' }}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d' }}>
                      Aktive Matches
                    </Typography>
                    <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                    
                    <List sx={{ p: 0 }}>
                      {activeMatches.map((match) => (
                        <ListItem
                          key={match.id}
                          sx={{ 
                            borderRadius: 1, 
                            mb: 1,
                            bgcolor: 'rgba(0,0,0,0.2)'
                          }}
                          secondaryAction={
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button 
                                variant="contained" 
                                size="small"
                                onClick={() => goToMatch(match.id)}
                                sx={{ 
                                  bgcolor: '#00ff9d', 
                                  color: '#0a1929',
                                  '&:hover': { bgcolor: '#00cc7d' }
                                }}
                              >
                                Beitreten
                              </Button>
                              <Tooltip title="Match löschen">
                                <IconButton 
                                  sx={{ color: '#ff0062' }}
                                  onClick={() => deleteMatch(match.id)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          }
                        >
                          <ListItemIcon>
                            <SportsKabaddiIcon sx={{ color: '#00ff9d' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={
                              <Typography sx={{ color: '#fff' }}>
                                {`Match gegen ${match.player1_username === localStorage.getItem('username') 
                                  ? match.player2_username 
                                  : match.player1_username}`}
                              </Typography>
                            }
                            secondary={
                              <Typography sx={{ color: '#aaa', fontSize: '0.8rem' }}>
                                {`Status: ${match.status === 'lobby' ? 'In der Lobby' : 'Aktiv'}`}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              )}
              
              {/* Wenn keine aktiven Elemente vorhanden sind */}
              {friendsWithWatchlist.length === 0 && receivedInvites.length === 0 && activeMatches.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" sx={{ color: '#00ff9d', mb: 2 }}>
                      Keine Match-Aktivitäten
                    </Typography>
                    <Typography sx={{ color: '#fff' }}>
                      Füge Freunde hinzu, um Matches zu starten und gemeinsam zu spielen.
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        ) : (
          <Box>
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

            {/* Neue Gruppe erstellen */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(0,255,157,0.07)' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d' }}>
                Neue Gruppen-Watchlist erstellen
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Gruppenname eingeben..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.23)',
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
                  onClick={createGroupWatchlist}
                  disabled={isCreatingGroup || !newGroupName.trim()}
                  startIcon={isCreatingGroup ? <CircularProgress size={20} /> : <AddIcon />}
                  sx={{
                    bgcolor: '#00ff9d',
                    color: '#0a1929',
                    '&:hover': { bgcolor: '#00cc7d' },
                    '&.Mui-disabled': {
                      bgcolor: 'rgba(0,255,157,0.3)',
                    },
                  }}
                >
                  {isCreatingGroup ? 'Erstelle...' : 'Erstellen'}
                </Button>
              </Box>
            </Paper>

            {/* Liste der Gruppen-Watchlists */}
            <Paper sx={{ p: 2, bgcolor: 'rgba(0,255,157,0.07)' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d' }}>
                Meine Gruppen-Watchlists
              </Typography>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

              {loadingGroups ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress sx={{ color: '#00ff9d' }} />
                </Box>
              ) : !groupWatchlists || (!groupWatchlists.accepted && !groupWatchlists.pending) ? (
                <Typography sx={{ color: '#aaa', textAlign: 'center', py: 2 }}>
                  Du hast noch keine Gruppen-Watchlists erstellt.
                </Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {/* Akzeptierte Gruppen */}
                  {groupWatchlists.accepted && groupWatchlists.accepted.map((group) => (
                    <ListItem
                      key={group.id}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        bgcolor: 'rgba(0,0,0,0.2)',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.3)' }
                      }}
                      secondaryAction={
                        group.creator_username === username && (
                          <Tooltip title="Gruppe löschen">
                            <IconButton
                              edge="end"
                              sx={{ color: '#ff0062' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteGroupWatchlist(group.id);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )
                      }
                      onClick={() => navigate(`/group-watchlist/${group.id}`)}
                    >
                      <ListItemIcon>
                        <FolderSharedIcon sx={{ color: '#00ff9d' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography sx={{ color: '#fff' }}>
                            {group.name}
                          </Typography>
                        }
                        secondary={
                          <Typography sx={{ color: '#aaa', fontSize: '0.8rem' }}>
                            {`Erstellt von: ${group.creator_username}`}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}

                  {/* Ausstehende Einladungen */}
                  {groupWatchlists.pending && groupWatchlists.pending.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ color: '#00ff9d', mt: 3, mb: 2 }}>
                        Ausstehende Einladungen
                      </Typography>
                      {groupWatchlists.pending.map((group) => (
                        <ListItem
                          key={group.id}
                          sx={{
                            borderRadius: 1,
                            mb: 1,
                            bgcolor: 'rgba(255,0,98,0.1)',
                            border: '1px solid rgba(255,0,98,0.2)'
                          }}
                        >
                          <ListItemIcon>
                            <FolderSharedIcon sx={{ color: '#ff0062' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography sx={{ color: '#fff' }}>
                                {group.name}
                              </Typography>
                            }
                            secondary={
                              <Typography sx={{ color: '#aaa', fontSize: '0.8rem' }}>
                                {`Einladung von: ${group.creator_username}`}
                              </Typography>
                            }
                          />
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              sx={{
                                bgcolor: '#00ff9d',
                                color: '#0a1929',
                                '&:hover': { bgcolor: '#00cc7d' }
                              }}
                              onClick={() => handleAcceptInvite(group.id)}
                            >
                              Annehmen
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              sx={{
                                color: '#ff0062',
                                borderColor: '#ff0062',
                                '&:hover': {
                                  borderColor: '#ff0062',
                                  bgcolor: 'rgba(255,0,98,0.1)'
                                }
                              }}
                              onClick={() => handleRejectInvite(group.id)}
                            >
                              Ablehnen
                            </Button>
                          </Box>
                        </ListItem>
                      ))}
                    </>
                  )}
                </List>
              )}
            </Paper>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MultiplayerDialog; 