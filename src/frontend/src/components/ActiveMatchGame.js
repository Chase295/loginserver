import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import MatchSwipe from './MatchSwipe';

const ActiveMatchGame = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

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
      
      // Wenn das Match nicht aktiv ist, zurück zur Lobby leiten
      if (matchData.status !== 'active') {
        navigate(`/match/${matchId}`);
        return;
      }
      
      setMatch(matchData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [matchId, token, navigate]);
  
  useEffect(() => {
    if (token && matchId) {
      loadMatchData();
    }
  }, [token, matchId, loadMatchData]);

  const goBackToDashboard = () => {
    navigate('/dashboard');
  };

  const isPlayer1 = match && currentUsername === match.player1_username;
  const isPlayer2 = match && currentUsername === match.player2_username;
  const isCurrentUserInMatch = isPlayer1 || isPlayer2;

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
          onClick={goBackToDashboard}
          sx={{ mt: 2 }}
        >
          Zurück zum Dashboard
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
          onClick={goBackToDashboard}
          sx={{ mt: 2 }}
        >
          Zurück zum Dashboard
        </Button>
      </Box>
    );
  }

  if (!isCurrentUserInMatch) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
        <Alert severity="warning">
          Du bist kein Teilnehmer dieses Matches.
        </Alert>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={goBackToDashboard}
          sx={{ mt: 2 }}
        >
          Zurück zum Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: {xs: 2, sm: 3, md: 4}, maxWidth: 1200, margin: '0 auto', color: '#e2e8f0' }}>
      <Button
        variant="outlined"
        startIcon={<ArrowBackIcon />}
        onClick={goBackToDashboard}
        sx={{
          color: '#00ff9d',
          mb: 4,
          '&:hover': {
            backgroundColor: 'rgba(0, 255, 157, 0.1)'
          }
        }}
      >
        Zurück zum Dashboard
      </Button>

      <MatchSwipe matchId={matchId} onBack={goBackToDashboard} />
    </Box>
  );
};

export default ActiveMatchGame; 