import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Typography,
  Box,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Autocomplete,
  Paper,
  Tooltip
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import GroupIcon from '@mui/icons-material/Group';
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';

const GroupWatchlistSettings = ({ open, onClose, group, members, onSave, isAdmin }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [receivedInvites, setReceivedInvites] = useState([]);

  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');

  // Freundesliste und Einladungen laden
  const loadFriendsAndInvites = async () => {
    if (!open || !group?.id) return;
    
    try {
      // Zuerst gesendete Einladungen laden
      try {
        const sentInvitesResponse = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}/invites/sent`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (sentInvitesResponse.ok) {
          const sentInvitesData = await sentInvitesResponse.json();
          console.log('[GroupWatchlistSettings] Loaded sent invites:', sentInvitesData);
          setSentInvites(sentInvitesData);
        }
      } catch (err) {
        console.log('Keine gesendeten Einladungen gefunden:', err);
        setSentInvites([]);
      }

      // Dann empfangene Einladungen laden
      try {
        const receivedInvitesResponse = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}/invites/received`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (receivedInvitesResponse.ok) {
          const receivedInvitesData = await receivedInvitesResponse.json();
          setReceivedInvites(receivedInvitesData);
        }
      } catch (err) {
        console.log('Keine empfangenen Einladungen gefunden:', err);
        setReceivedInvites([]);
      }

      // Zuletzt Freunde laden und filtern
      const friendsResponse = await fetch('http://localhost:8000/api/friends/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!friendsResponse.ok) throw new Error('Fehler beim Laden der Freunde');
      const friendsData = await friendsResponse.json();
      
      // Filtere Freunde, die bereits Mitglied sind oder eingeladen wurden
      const availableFriends = friendsData.filter(friend => {
        const friendUsername = friend.friend_username || friend.username;
        
        // Prüfe ob der Freund bereits Mitglied ist
        const isMember = members.some(member => member.username === friendUsername);
        if (isMember) {
          console.log(`[GroupWatchlistSettings] ${friendUsername} is already a member`);
          return false;
        }
        
        // Prüfe ob der Freund bereits eine ausstehende Einladung hat
        const isPending = sentInvites.some(invite => invite.receiver_username === friendUsername);
        if (isPending) {
          console.log(`[GroupWatchlistSettings] ${friendUsername} has a pending invite`);
          return false;
        }
        
        return true;
      });
      
      console.log('[GroupWatchlistSettings] Available friends:', {
        total: friendsData.length,
        available: availableFriends.length,
        members: members.length,
        sentInvites: sentInvites.length
      });
      
      setFriendsList(availableFriends);
    } catch (err) {
      console.error('[GroupWatchlistSettings] Error loading data:', err);
      setError('Fehler beim Laden der Daten');
    }
  };

  useEffect(() => {
    loadFriendsAndInvites();
  }, [open, group?.id, members]);

  // Einladung senden
  const handleInviteFriend = async (friendUsername) => {
    if (!group?.id || !friendUsername) {
      console.error('[GroupWatchlistSettings] Invalid group ID or username:', { groupId: group?.id, friendUsername });
      setError('Ungültige Gruppen- oder Benutzerinformationen');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log(`[GroupWatchlistSettings] Sending invite to ${friendUsername} for group ${group.id}`);
      
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: friendUsername })
      });

      const data = await response.json();
      console.log('[GroupWatchlistSettings] Invite response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Hinzufügen des Mitglieds');
      }

      setSuccess('Einladung erfolgreich gesendet');
      
      // Aktualisiere die Listen
      await loadFriendsAndInvites();
      if (onSave) onSave();
    } catch (err) {
      console.error('[GroupWatchlistSettings] Error sending invite:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Einladung zurückziehen
  const handleCancelInvite = async (inviteId) => {
    if (!group?.id || !inviteId) {
      console.error('[GroupWatchlistSettings] Invalid group ID or invite ID:', { groupId: group?.id, inviteId });
      setError('Ungültige Gruppen- oder Einladungsinformationen');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log(`[GroupWatchlistSettings] Canceling invite ${inviteId} for group ${group.id}`);
      
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}/invites/${inviteId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      console.log('[GroupWatchlistSettings] Cancel response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Zurückziehen der Einladung');
      }

      setSuccess('Einladung erfolgreich zurückgezogen');
      await loadFriendsAndInvites();
      if (onSave) onSave();
    } catch (err) {
      console.error('[GroupWatchlistSettings] Error canceling invite:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Prüfen ob ein Freund bereits eingeladen wurde
  const isInvited = (friendUsername) => {
    return sentInvites.some(invite => 
      invite.receiver_username === friendUsername || 
      invite.receiver_username === friendUsername
    );
  };

  const handleRemoveMember = async (member) => {
    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}/members/${member.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Entfernen des Mitglieds');
      }

      // Aktualisiere die Mitgliederliste
      await loadFriendsAndInvites();
      setSuccess('Mitglied erfolgreich entfernt');
      
      // Aktualisiere die Hauptansicht
      if (onSave) onSave();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group?.id) {
      onClose();
      navigate('/dashboard');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Fehler beim Löschen der Gruppe');
      }

      setSuccess('Gruppe erfolgreich gelöscht');
      setTimeout(() => {
        onClose();
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Einladung annehmen oder ablehnen
  const handleInviteResponse = async (groupId, action) => {
    if (!groupId) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${groupId}/invites/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Fehler beim ${action === 'accept' ? 'Annehmen' : 'Ablehnen'} der Einladung`);
      }

      setSuccess(`Einladung erfolgreich ${action === 'accept' ? 'angenommen' : 'abgelehnt'}`);
      
      // Aktualisiere die Listen
      await loadFriendsAndInvites();
      if (onSave) onSave();
      
      // Navigiere zur entsprechenden Seite
      setTimeout(() => {
        if (action === 'accept') {
          navigate(`/group/${groupId}`);
        } else {
          navigate('/dashboard');
        }
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a2027',
            backgroundImage: 'linear-gradient(rgba(0,255,157,0.05), rgba(0,255,157,0))',
            border: '1px solid rgba(0,255,157,0.1)',
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ 
          color: '#00ff9d',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <GroupIcon />
          Gruppenmitglieder verwalten
        </DialogTitle>

        <DialogContent>
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

          {isAdmin && (
            <>
              <Paper sx={{ 
                p: 2, 
                mb: 3, 
                bgcolor: 'rgba(0,255,157,0.07)',
                border: '1px solid rgba(0,255,157,0.1)',
                borderRadius: 2,
              }}>
                <Typography variant="h6" gutterBottom sx={{ 
                  color: '#00ff9d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <PersonAddIcon />
                  Freunde einladen
                </Typography>
                
                {friendsList.length === 0 ? (
                  <Box sx={{ 
                    p: 3, 
                    textAlign: 'center',
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 1
                  }}>
                    <Typography sx={{ color: '#aaa' }}>
                      Keine weiteren Freunde zum Einladen verfügbar.
                    </Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {friendsList.map((friend) => {
                      const friendUsername = friend.friend_username || friend.username;
                      const isAlreadyInvited = isInvited(friendUsername);
                      
                      return (
                        <ListItem
                          key={friendUsername}
                          sx={{
                            borderRadius: 1,
                            mb: 1,
                            bgcolor: 'rgba(0,0,0,0.2)',
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: 'rgba(0,255,157,0.1)',
                            }
                          }}
                          secondaryAction={
                            isAlreadyInvited ? (
                              <Tooltip title="Einladung zurückziehen">
                                <IconButton 
                                  edge="end" 
                                  sx={{ 
                                    color: '#ff0062',
                                    '&:hover': {
                                      bgcolor: 'rgba(255,0,98,0.1)',
                                    }
                                  }}
                                  onClick={() => {
                                    const invite = sentInvites.find(invite => 
                                      invite.receiver_username === friendUsername
                                    );
                                    if (invite) {
                                      handleCancelInvite(invite.id);
                                    }
                                  }}
                                >
                                  <CancelIcon />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Einladen">
                                <IconButton 
                                  edge="end" 
                                  sx={{ 
                                    color: '#00ff9d',
                                    '&:hover': {
                                      bgcolor: 'rgba(0,255,157,0.1)',
                                    }
                                  }}
                                  onClick={() => handleInviteFriend(friendUsername)}
                                >
                                  <PersonAddIcon />
                                </IconButton>
                              </Tooltip>
                            )
                          }
                        >
                          <ListItemIcon>
                            <PersonIcon sx={{ color: isAlreadyInvited ? '#ff0062' : '#00ff9d' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={
                              <Typography sx={{ 
                                color: '#fff',
                                fontWeight: 500
                              }}>
                                {friendUsername}
                              </Typography>
                            }
                            secondary={
                              isAlreadyInvited ? (
                                <Typography sx={{ 
                                  color: '#ff0062',
                                  fontSize: '0.8rem'
                                }}>
                                  Einladung ausstehend
                                </Typography>
                              ) : null
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Paper>

              {/* Gesendete Einladungen */}
              {sentInvites.length > 0 && (
                <Paper sx={{ 
                  p: 2, 
                  mb: 3, 
                  bgcolor: 'rgba(255,0,98,0.07)',
                  border: '1px solid rgba(255,0,98,0.1)',
                  borderRadius: 2,
                }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#ff0062' }}>
                    Ausstehende Einladungen
                  </Typography>
                  <List>
                    {sentInvites.map((invite) => (
                      <ListItem
                        key={invite.receiver_username}
                        sx={{
                          bgcolor: 'rgba(0,0,0,0.2)',
                          borderRadius: 1,
                          mb: 1
                        }}
                        secondaryAction={
                          <Tooltip title="Einladung zurückziehen">
                            <IconButton
                              edge="end"
                              onClick={() => handleCancelInvite(invite.id)}
                              sx={{ color: '#ff0062' }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemIcon>
                          <PersonIcon sx={{ color: '#ff0062' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={invite.receiver_username}
                          secondary="Einladung ausstehend"
                          primaryTypographyProps={{ color: '#fff' }}
                          secondaryTypographyProps={{ color: '#ff0062' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}

              <Divider sx={{ mb: 2, borderColor: 'rgba(0,255,157,0.1)' }} />
            </>
          )}

          {/* Empfangene Einladungen */}
          {receivedInvites.length > 0 && (
            <Paper sx={{ 
              p: 2, 
              mb: 3, 
              bgcolor: 'rgba(0,255,157,0.07)',
              border: '1px solid rgba(0,255,157,0.1)',
              borderRadius: 2,
            }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d' }}>
                Einladungen für dich
              </Typography>
              <List>
                {receivedInvites.map((invite) => (
                  <ListItem
                    key={invite.sender_username}
                    sx={{
                      bgcolor: 'rgba(0,0,0,0.2)',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemIcon>
                      <PersonIcon sx={{ color: '#00ff9d' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Einladung von ${invite.sender_username}`}
                      primaryTypographyProps={{ color: '#fff' }}
                    />
                    <Box>
                      <Tooltip title="Annehmen">
                        <IconButton
                          onClick={() => handleInviteResponse(invite.group_id, 'accept')}
                          sx={{ color: '#00ff9d', mr: 1 }}
                        >
                          <CheckCircleIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ablehnen">
                        <IconButton
                          onClick={() => handleInviteResponse(invite.group_id, 'reject')}
                          sx={{ color: '#ff0062' }}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d' }}>
            Aktuelle Mitglieder
          </Typography>
          
          <List>
            {members.map((member) => (
              <ListItem
                key={member.id}
                sx={{
                  bgcolor: 'rgba(0,0,0,0.2)',
                  borderRadius: 1,
                  mb: 1
                }}
              >
                <ListItemIcon>
                  <PersonIcon sx={{ color: member.username === group?.creator_username ? '#00ff9d' : '#fff' }} />
                </ListItemIcon>
                <ListItemText
                  primary={member.username}
                  secondary={member.username === group?.creator_username ? 'Admin' : 'Mitglied'}
                  primaryTypographyProps={{ color: '#fff' }}
                  secondaryTypographyProps={{ color: member.username === group?.creator_username ? '#00ff9d' : '#aaa' }}
                />
                {isAdmin && member.username !== username && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveMember(member)}
                      disabled={loading}
                      sx={{ color: '#ff0062' }}
                    >
                      <PersonRemoveIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>

          {isAdmin && (
            <Box sx={{ mt: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={loading}
                sx={{
                  borderColor: '#ff0062',
                  color: '#ff0062',
                  '&:hover': {
                    borderColor: '#ff0062',
                    bgcolor: 'rgba(255,0,98,0.1)'
                  }
                }}
              >
                Gruppe löschen
              </Button>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={onClose}
            disabled={loading}
            sx={{ color: '#aaa' }}
          >
            Schließen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a2027',
            border: '1px solid rgba(255,0,98,0.2)',
            borderRadius: 2,
          }
        }}
      >
        <DialogTitle sx={{ color: '#ff0062' }}>
          Gruppe löschen
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#fff' }}>
            Möchtest du die Gruppe "{group?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={loading}
            sx={{ color: '#aaa' }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleDeleteGroup}
            disabled={loading}
            color="error"
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GroupWatchlistSettings; 