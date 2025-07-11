import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const InviteFriendsDialog = ({ open, onClose, groupId }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [inviting, setInviting] = useState({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch('/api/friends/list', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        setFriends(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Fehler beim Laden der Freunde');
        setLoading(false);
      });
  }, [open]);

  const handleInvite = async (friendUsername) => {
    setInviting(prev => ({ ...prev, [friendUsername]: true }));
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/watchlist/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: friendUsername })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Einladen');
      setSuccess(`Einladung an ${friendUsername} gesendet!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(prev => ({ ...prev, [friendUsername]: false }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Freunde einladen</DialogTitle>
      <DialogContent>
        {loading && <CircularProgress />}
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}
        {!loading && friends.length === 0 && (
          <Typography>Keine Freunde gefunden.</Typography>
        )}
        <List>
          {friends.map(friend => {
            const uname = friend.friend_username || friend.username;
            return (
              <ListItem key={uname} secondaryAction={
                <IconButton
                  edge="end"
                  onClick={() => handleInvite(uname)}
                  disabled={inviting[uname]}
                  color="primary"
                >
                  <PersonAddIcon />
                </IconButton>
              }>
                <ListItemText primary={uname} />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteFriendsDialog; 