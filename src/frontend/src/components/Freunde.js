import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, Chip, Avatar, Grid } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import TextField from '@mui/material/TextField';
import axios from 'axios';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = 'http://localhost:8000';

const Freunde = () => {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sent, setSent] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');
  const [friends, setFriends] = useState([]);
  const [editFriend, setEditFriend] = useState(null);
  const [editLevel, setEditLevel] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const levelOptions = [
    { value: 'bff', label: 'BFF', emoji: '🦄', level: 5 },
    { value: 'buddy', label: 'Buddy', emoji: '🤝', level: 3 },
    { value: 'hot', label: '🔥', emoji: '🔥', level: 4 },
    { value: 'pro', label: 'Pro', emoji: '💯', level: 2 },
    { value: 'casual', label: 'Casual', emoji: '😎', level: 1 },
  ];
  const navigate = useNavigate();

  // Lade alle User (außer sich selbst)
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        // Hole alle User außer sich selbst
        const res = await axios.get(`${BACKEND_URL}/api/userlist`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Filtere User, die bereits Freunde sind
        const friendsUsernames = friends.map(f => f.friend_username);
        setUsers(res.data.filter(u => 
          u.username !== username && 
          !friendsUsernames.includes(u.username)
        ));
      } catch (e) {
        setError('Fehler beim Laden der Spieler');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [token, username, friends]);

  // Lade Freundschaftsanfragen
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/friends/requests`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRequests(res.data);
      } catch (e) {
        setError('Fehler beim Laden der Anfragen');
      }
    };
    fetchRequests();
  }, [token]);

  // Anfrage senden
  const sendRequest = async (receiver_username) => {
    try {
      await axios.post(`${BACKEND_URL}/api/friends/request`, { receiver_username }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSent([...sent, receiver_username]);
      setSuccess('Anfrage gesendet!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Senden der Anfrage');
      setTimeout(() => setError(null), 2000);
    }
  };

  // Anfrage annehmen/ablehnen
  const handleRespond = async (request_id, accept) => {
    try {
      await axios.post(`${BACKEND_URL}/api/friends/respond`, { request_id, accept }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(requests.filter(r => r.id !== request_id));
      setSuccess(accept ? 'Freundschaft angenommen!' : 'Anfrage abgelehnt!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Antworten');
      setTimeout(() => setError(null), 2000);
    }
  };

  // Freunde laden
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/friends/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFriends(res.data);
      } catch (e) {
        setError('Fehler beim Laden der Freunde');
      }
    };
    fetchFriends();
  }, [token]);

  // Gefilterte User-Liste (mind. 2 Buchstaben, keine offenen/abgelehnten Anfragen)
  const filteredUsers = search.length >= 2
    ? users.filter(u =>
        u.username.toLowerCase().startsWith(search.toLowerCase()) &&
        !sent.includes(u.username) &&
        !requests.some(r => r.sender_username === u.username) &&
        !friends.some(f => f.friend_username === u.username)
      )
    : [];

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)', py: 4 }}>
      <Paper elevation={3} sx={{ maxWidth: 1000, width: '100%', mx: 'auto', p: 4, borderRadius: 3, background: 'rgba(255,255,255,0.04)', position: 'relative' }}>
        <IconButton onClick={() => navigate('/dashboard')} sx={{ position: 'absolute', top: 24, left: 24, color: '#00ff9d', bgcolor: 'rgba(10,25,41,0.7)', '&:hover': { bgcolor: 'rgba(0,255,157,0.15)' }, boxShadow: 2 }}>
          <ArrowBackIcon sx={{ fontSize: 32 }} />
        </IconButton>
        <Chip
          label={`Eingeloggt als: ${username}`}
          sx={{ position: 'absolute', top: 28, right: 28, bgcolor: '#00ff9d', color: '#0a1929', fontWeight: 700, fontSize: 16, px: 2, boxShadow: 2 }}
        />
        <Typography variant="h4" sx={{ color: '#00ff9d', mb: 3, textAlign: 'center' }}>
          <GroupIcon sx={{ mr: 1, fontSize: 36 }} /> Freunde
        </Typography>
        <TextField
          variant="outlined"
          placeholder="Spieler suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
          sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.07)', borderRadius: 2 }}
        />
        {error && <Typography sx={{ color: '#ff0062', mb: 2 }}>{error}</Typography>}
        {success && <Typography sx={{ color: '#00ff9d', mb: 2 }}>{success}</Typography>}
        {loading ? (
          <Typography sx={{ color: '#aaa' }}>Lade Spieler...</Typography>
        ) : (
          <>
            <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
              Spieler
            </Typography>
            <Grid container spacing={2}>
              {filteredUsers.length === 0 && search.length >= 2 && (
                <Grid item xs={12}>
                  <Typography sx={{ color: '#aaa', textAlign: 'center' }}>Kein Spieler gefunden.</Typography>
                </Grid>
              )}
              {filteredUsers.map(user => (
                <Grid item xs={12} sm={6} key={user.username}>
                  <Paper sx={{ display: 'flex', alignItems: 'center', p: 2, borderRadius: 2, background: 'rgba(0,255,157,0.07)' }}>
                    <Avatar sx={{ bgcolor: '#00ff9d', color: '#0a1929', mr: 2 }}>
                      {user.username[0].toUpperCase()}
                    </Avatar>
                    <Typography sx={{ flex: 1, color: '#fff', fontWeight: 500 }}>{user.username}</Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PersonAddIcon />}
                      disabled={sent.includes(user.username)}
                      onClick={() => sendRequest(user.username)}
                      sx={{ bgcolor: '#00ff9d', color: '#0a1929', fontWeight: 'bold', borderRadius: 2, ml: 1 }}
                    >
                      {sent.includes(user.username) ? 'Angefragt' : 'Anfrage senden'}
                    </Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
            Freundschaftsanfragen
          </Typography>
          {requests.length === 0 && (
            <Typography sx={{ color: '#aaa' }}>Keine offenen Anfragen.</Typography>
          )}
          {requests.map(req => (
            <Paper key={req.id} sx={{ display: 'flex', alignItems: 'center', p: 2, borderRadius: 2, mb: 2, background: 'rgba(255,0,98,0.07)' }}>
              <Avatar sx={{ bgcolor: '#ff0062', color: '#fff', mr: 2 }}>{req.sender_username[0].toUpperCase()}</Avatar>
              <Typography sx={{ flex: 1, color: '#fff', fontWeight: 500 }}>{req.sender_username}</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<CheckIcon />}
                onClick={() => handleRespond(req.id, true)}
                sx={{ bgcolor: '#00ff9d', color: '#0a1929', fontWeight: 'bold', borderRadius: 2, mr: 1 }}
              >
                Annehmen
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloseIcon />}
                onClick={() => handleRespond(req.id, false)}
                sx={{ color: '#ff0062', borderColor: '#ff0062', fontWeight: 'bold', borderRadius: 2 }}
              >
                Ablehnen
              </Button>
            </Paper>
          ))}
        </Box>
        <Box sx={{ mt: 5 }}>
          <Typography variant="h5" sx={{ color: '#00ff9d', mb: 2, fontWeight: 700 }}>Deine Freunde</Typography>
          {friends.length === 0 && <Typography sx={{ color: '#fff', opacity: 0.7 }}>Noch keine Freunde gefunden.</Typography>}
          <Grid container spacing={2} justifyContent="center">
            {friends.map(friend => {
              const level = levelOptions.find(l => l.value === friend.friendship_level) || { label: 'Freund', emoji: '🤝', level: 1 };
              const isLevelPending = !friend.level_confirmed && friend.last_proposed_by && friend.last_proposed_by !== username;
              return (
                <Grid item xs={12} sm={12} md={10} key={friend.id}>
                  <Paper elevation={4} sx={{ width: '100%', maxWidth: 900, p: 2, borderRadius: 3, bgcolor: '#1a2233', mx: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 3 }}>
                      <Avatar sx={{ bgcolor: '#00ff9d', color: '#0a1929', fontWeight: 700, width: 56, height: 56, fontSize: 32 }}>{friend.friend_username[0]?.toUpperCase()}</Avatar>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 22, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friend.friend_username}</Typography>
                      <span style={{ fontSize: 28 }}>{level.emoji}</span>
                      <Typography variant="caption" sx={{ color: '#00ff9d', fontWeight: 600, fontSize: 20 }}>{level.label} ({level.level})</Typography>
                      {!friend.level_confirmed && <span style={{ fontSize: 22, marginLeft: 8, opacity: 0.7 }}>⏳</span>}
                      <Button
                        variant="outlined"
                        color="info"
                        startIcon={<EditIcon />}
                        onClick={() => { setEditFriend(friend); setEditLevel(friend.friendship_level || ''); }}
                        sx={{ borderRadius: 2, minWidth: 0, px: 3, fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap', fontSize: 20, ml: 2 }}
                      >
                        Bearbeiten
                      </Button>
                    </Box>
                    {/* Level-Anfrage-Bestätigung */}
                    {isLevelPending && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,255,157,0.07)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ color: '#00ff9d', fontWeight: 600 }}>
                          {friend.friend_username} möchte das Level ändern: {level.emoji} {level.label} ({level.level})
                        </Typography>
                        <Button variant="contained" color="success" size="small" sx={{ ml: 2 }}>Akzeptieren</Button>
                        <Button variant="outlined" color="error" size="small">Ablehnen</Button>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Paper>
      <Dialog open={!!editFriend} onClose={() => setEditFriend(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0a1929', color: '#00ff9d', fontWeight: 700, textAlign: 'center' }}>Freundschaft bearbeiten</DialogTitle>
        <DialogContent sx={{ bgcolor: '#1a2233', color: '#fff', textAlign: 'center' }}>
          <Typography sx={{ mb: 2, fontWeight: 500 }}>Wie cool ist <span style={{ color: '#00ff9d' }}>{editFriend?.friend_username}</span>?</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
            {levelOptions.map(opt => (
              <Button
                key={opt.value}
                variant={editLevel === opt.value ? 'contained' : 'outlined'}
                sx={{
                  bgcolor: editLevel === opt.value ? '#00ff9d' : '#1a2233',
                  color: editLevel === opt.value ? '#0a1929' : '#fff',
                  borderRadius: 3,
                  fontSize: 28,
                  minWidth: 56,
                  border: editLevel === opt.value ? '2.5px solid #00ff9d' : '1.5px solid #00ff9d',
                  boxShadow: editLevel === opt.value ? '0 0 12px #00ff9d88' : 'none',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: '#00ff9d', color: '#0a1929' }
                }}
                onClick={() => setEditLevel(opt.value)}
              >
                {opt.emoji}
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#1a2233', justifyContent: 'space-between', p: 2 }}>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={async () => {
              setEditLoading(true);
              const token = localStorage.getItem('token');
              try {
                const res = await fetch(`${BACKEND_URL}/api/friends/delete`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ friend_id: editFriend.id })
                });
                if (!res.ok) throw new Error('Fehler beim Löschen');
                setEditLoading(false);
                setEditFriend(null);
                setSuccess('Freund gelöscht!');
                setTimeout(() => setSuccess(null), 2000);
                // Freunde neu laden
                const res2 = await fetch(`${BACKEND_URL}/api/friends/list`, { headers: { Authorization: `Bearer ${token}` } });
                setFriends(await res2.json());
              } catch (e) {
                setEditLoading(false);
                setError('Fehler beim Löschen');
                setTimeout(() => setError(null), 2000);
              }
            }}
            disabled={editLoading}
          >
            Löschen
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<EmojiEmotionsIcon />}
            onClick={async () => {
              setEditLoading(true);
              const token = localStorage.getItem('token');
              await fetch(`${BACKEND_URL}/api/friends/level`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ friend_id: editFriend.id, friendship_level: editLevel })
              });
              setEditLoading(false);
              setEditFriend(null);
              // Freunde neu laden
              const res = await fetch(`${BACKEND_URL}/api/friends/list`, { headers: { Authorization: `Bearer ${token}` } });
              setFriends(await res.json());
            }}
            disabled={editLoading || !editLevel}
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Freunde; 