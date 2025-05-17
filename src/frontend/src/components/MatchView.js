import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Paper,
  Card,
  CardContent,
  CardActions,
  Grid,
  Divider,
  Alert
} from '@mui/material';
import axios from 'axios';
import { API_URL } from '../config';
import MatchSwipe from './MatchSwipe';

const MatchView = ({ matchId, onBack }) => {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusPolling, setStatusPolling] = useState(null);
  const [readyStatus, setReadyStatus] = useState([]);
  const [userReady, setUserReady] = useState(false);
  const [moviesToAdd, setMoviesToAdd] = useState([]);
  const [addingMovies, setAddingMovies] = useState(false);
  
  // Status regelmäßig abrufen
  useEffect(() => {
    loadMatchStatus();
    
    // Polling einrichten (alle 3 Sekunden)
    const polling = setInterval(() => {
      loadMatchStatus();
    }, 3000);
    
    setStatusPolling(polling);
    
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [matchId]);
  
  // Match-Status laden
  const loadMatchStatus = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/match/${matchId}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMatch(response.data.match);
      setReadyStatus(response.data.readyStatus || []);
      setUserReady(response.data.userReady || false);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden des Match-Status:', error);
      setError('Fehler beim Laden des Match-Status. Bitte versuche es später erneut.');
      setLoading(false);
    }
  };
  
  // Filme aus der Watchlist laden
  const loadWatchlistMovies = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Lade Filme aus der Watchlist...');
      const response = await axios.get(`${API_URL}/api/watchlist/movies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Filme aus der Watchlist geladen:', response.data);
      
      // Zufällig bis zu 10 Filme aus der Watchlist auswählen
      const shuffled = [...response.data].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10).map(movie => movie.id);
      
      console.log('Ausgewählte Film-IDs:', selected);
      setMoviesToAdd(selected);
    } catch (error) {
      console.error('Fehler beim Laden der Watchlist-Filme:', error);
      setError('Fehler beim Laden deiner Filme');
    }
  };
  
  // "Bereit"-Status setzen
  const handleReady = async () => {
    try {
      setError(null);
      
      // Wenn noch keine Filme ausgewählt wurden, lade zufällige Filme
      if (moviesToAdd.length === 0) {
        console.log('Keine Filme zum Hinzufügen ausgewählt, lade Filme aus der Watchlist...');
        await loadWatchlistMovies();
      }
      
      console.log('Filme zum Hinzufügen:', moviesToAdd);
      
      // Filme zum Pool hinzufügen
      setAddingMovies(true);
      const token = localStorage.getItem('token');
      
      console.log(`Sende POST-Anfrage an ${API_URL}/api/match/${matchId}/pool mit Filmen:`, moviesToAdd);
      try {
        const poolResponse = await axios.post(
          `${API_URL}/api/match/${matchId}/pool`,
          { movie_ids: moviesToAdd },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Antwort vom Server nach dem Hinzufügen von Filmen:', poolResponse.data);
      } catch (poolError) {
        console.error('Fehler beim Hinzufügen der Filme zum Pool:', poolError);
        setError('Fehler beim Hinzufügen der Filme zum Pool');
        setAddingMovies(false);
        return;
      }
      
      setAddingMovies(false);
      
      // Als bereit markieren
      console.log(`Sende POST-Anfrage an ${API_URL}/api/match/${matchId}/ready`);
      try {
        const readyResponse = await axios.post(
          `${API_URL}/api/match/${matchId}/ready`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Antwort vom Server nach dem Setzen des Ready-Status:', readyResponse.data);
      } catch (readyError) {
        console.error('Fehler beim Setzen des Ready-Status:', readyError);
        setError('Fehler beim Setzen des Ready-Status');
        return;
      }
      
      // Status aktualisieren
      loadMatchStatus();
    } catch (error) {
      console.error('Fehler beim Setzen des Bereit-Status:', error);
      setError('Fehler beim Vorbereiten des Matches');
      setAddingMovies(false);
    }
  };
  
  // Match abbrechen
  const handleCancel = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/match/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onBack(); // Zurück zur Übersicht
    } catch (error) {
      console.error('Fehler beim Abbrechen des Matches:', error);
      setError('Fehler beim Abbrechen des Matches');
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={onBack}>Zurück</Button>
      </Box>
    );
  }
  
  // Wenn das Match im aktiven Zustand ist, zeige die Swipe-Oberfläche
  if (match?.status === 'active') {
    return <MatchSwipe matchId={matchId} onBack={onBack} />;
  }
  
  // Sonst zeige die Lobby-Ansicht
  return (
    <Box sx={{ p: 2, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Match-Lobby
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Spieler 1
            </Typography>
            <Typography>
              {match?.player1_username}
              {readyStatus.some(rs => rs.player_id === match?.player1_id && rs.is_ready) && 
                ' (Bereit)'}
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Spieler 2
            </Typography>
            <Typography>
              {match?.player2_username}
              {readyStatus.some(rs => rs.player_id === match?.player2_id && rs.is_ready) && 
                ' (Bereit)'}
            </Typography>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography sx={{ mb: 2 }}>
          {readyStatus.length === 0 
            ? 'Beide Spieler müssen sich bereit erklären, um das Match zu starten.'
            : readyStatus.length === 1
              ? 'Ein Spieler ist bereit. Warte auf den anderen Spieler.'
              : 'Beide Spieler sind bereit! Das Match wird gestartet...'}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button 
            variant="outlined" 
            color="error" 
            onClick={handleCancel}
          >
            Match abbrechen
          </Button>
          
          {!userReady ? (
            <Button 
              variant="contained" 
              color="primary"
              onClick={handleReady}
              disabled={addingMovies}
            >
              {addingMovies ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Filme werden hinzugefügt...
                </>
              ) : (
                'Ich bin bereit'
              )}
            </Button>
          ) : (
            <Button 
              variant="contained" 
              color="success"
              disabled
            >
              Du bist bereit
            </Button>
          )}
        </Box>
      </Paper>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            So funktioniert's
          </Typography>
          <Typography variant="body2">
            1. Beide Spieler klicken auf "Ich bin bereit"
          </Typography>
          <Typography variant="body2">
            2. Filme aus beiden Watchlisten werden in den gemeinsamen Pool geworfen
          </Typography>
          <Typography variant="body2">
            3. Jeder Spieler bewertet die Filme des anderen mit "Gefällt mir" oder "Gefällt mir nicht"
          </Typography>
          <Typography variant="body2">
            4. Bei einem Match (beide mögen denselben Film) erscheint der Film in der Match-Liste
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MatchView; 