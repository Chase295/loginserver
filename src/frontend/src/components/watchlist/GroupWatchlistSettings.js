import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Typography,
  Box,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const GroupWatchlistSettings = ({
  open,
  onClose,
  group,
  members,
  onSave,
  isAdmin
}) => {
  const [newMember, setNewMember] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const token = localStorage.getItem('token');
  const currentUsername = localStorage.getItem('username');

  const handleAddMember = async () => {
    if (!newMember.trim()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: newMember.trim() })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Fehler beim Hinzufügen des Mitglieds');
      }

      setSuccess('Mitglied erfolgreich hinzugefügt');
      setNewMember('');
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (username) => {
    if (username === currentUsername && group.creator_username === currentUsername) {
      setError('Als Gruppenadmin kannst du dich nicht selbst entfernen');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`http://localhost:8000/api/watchlist/groups/${group.id}/members/${username}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Fehler beim Entfernen des Mitglieds');
      }

      setSuccess('Mitglied erfolgreich entfernt');
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ 
        bgcolor: '#0a1929', 
        color: '#00ff9d', 
        fontWeight: 700 
      }}>
        Gruppenmitglieder verwalten
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#1a2233', color: '#fff', p: 3 }}>
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
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              mb: 3 
            }}>
              <TextField
                fullWidth
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                placeholder="Benutzername eingeben..."
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.23)' },
                    '&:hover fieldset': { borderColor: '#00ff9d' },
                    '&.Mui-focused fieldset': { borderColor: '#00ff9d' }
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleAddMember}
                disabled={loading || !newMember.trim()}
                startIcon={loading ? <CircularProgress size={20} /> : <PersonAddIcon />}
                sx={{
                  bgcolor: '#00ff9d',
                  color: '#0a1929',
                  '&:hover': { bgcolor: '#00cc7d' },
                  '&.Mui-disabled': { bgcolor: 'rgba(0,255,157,0.3)' }
                }}
              >
                Hinzufügen
              </Button>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2 }} />
          </>
        )}

        <Typography variant="h6" gutterBottom sx={{ color: '#00ff9d' }}>
          Aktuelle Mitglieder
        </Typography>
        
        <List>
          {members.map((member) => (
            <ListItem
              key={member.username}
              sx={{
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 1,
                mb: 1
              }}
            >
              <ListItemText
                primary={member.username}
                secondary={member.username === group.creator_username ? 'Admin' : 'Mitglied'}
                primaryTypographyProps={{ color: '#fff' }}
                secondaryTypographyProps={{ color: '#00ff9d' }}
              />
              {isAdmin && member.username !== currentUsername && (
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveMember(member.username)}
                    disabled={loading}
                    sx={{ color: '#ff0062' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions sx={{ bgcolor: '#1a2233', p: 2 }}>
        <Button 
          onClick={onClose}
          sx={{ color: '#ff0062' }}
        >
          Schließen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GroupWatchlistSettings; 