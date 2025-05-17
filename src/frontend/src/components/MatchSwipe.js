import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardMedia, 
  CardContent, 
  Button, 
  IconButton, 
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  CircularProgress,
  Chip,
  Divider,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { 
  Close as CloseIcon,
  Favorite as FavoriteIcon,
  Info as InfoIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarMonthIcon,
  Movie as MovieIcon,
  Tv as TvIcon
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../config';
import WatchlistDetail from './watchlist/WatchlistDetail';
import MatchMovieCard from './MatchMovieCard';

const MatchSwipe = ({ matchId, onBack }) => {
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [currentMovieDetails, setCurrentMovieDetails] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swiping, setSwiping] = useState(false);
  const cardRef = useRef(null);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Mindestdistanz für einen Swipe
  const minSwipeDistance = 50;
  
  // Filme laden
  const loadMovies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log(`Lade Filme aus dem Pool für Match ${matchId}...`);
      const response = await axios.get(`${API_URL}/api/match/${matchId}/pool`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Antwort vom Server beim Laden der Filme aus dem Pool:', response.data);
      setMovies(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Filme:', error);
      setLoading(false);
    }
  };
  
  // Matches laden
  const loadMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log(`Lade Matches für Match ${matchId}...`);
      const response = await axios.get(`${API_URL}/api/match/${matchId}/matches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Antwort vom Server beim Laden der Matches:', response.data);
      setMatches(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Matches:', error);
    }
  };
  
  useEffect(() => {
    loadMovies();
    loadMatches();
  }, [matchId]);
  
  // Film liken oder disliken
  const handleLike = async (liked) => {
    if (movies.length === 0 || currentIndex >= movies.length) return;
    
    // Animation für Like/Dislike
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.5s ease';
      cardRef.current.style.transform = liked ? 'translateX(150%)' : 'translateX(-150%)';
      
      setTimeout(() => {
        if (cardRef.current) {
          cardRef.current.style.transition = 'none';
          cardRef.current.style.transform = 'translateX(0)';
        }
      }, 500);
    }
    
    const currentMovie = movies[currentIndex];
    
    try {
      const token = localStorage.getItem('token');
      console.log(`Bewerte Film ${currentMovie.id} mit ${liked ? 'Gefällt mir' : 'Gefällt mir nicht'}`);
      
      const response = await axios.post(
        `${API_URL}/api/match/${matchId}/like`,
        {
          movie_id: currentMovie.id,
          liked: liked
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('Antwort vom Server:', response.data);
      
      // Wenn es ein neues Match gibt, die Match-Liste aktualisieren und Feedback zeigen
      if (response.data.is_match) {
        console.log('Ein Match wurde gefunden! Beide Spieler mögen diesen Film.');
        loadMatches();
        
        // Dialog mit Match-Information anzeigen
        setCurrentMovieDetails(response.data.match_details || currentMovie);
        setShowDetails(true);
        
        // Optional: Kurze Animation oder Feedback für den Nutzer
        // Hier könnte ein Konfetti-Effekt oder ähnliches eingebaut werden
      }
      
      // Zum nächsten Film
      setCurrentIndex(prevIndex => {
        const nextIndex = prevIndex + 1;
        if (nextIndex >= movies.length) {
          // Wenn wir am Ende sind, neue Filme laden
          console.log('Keine weiteren Filme zum Bewerten. Lade neue Filme...');
          loadMovies();
          return 0;
        }
        return nextIndex;
      });
    } catch (error) {
      console.error('Fehler beim Bewerten des Films:', error);
      // Fehlermeldung anzeigen
      if (error.response) {
        console.error('Server-Antwort:', error.response.data);
      }
    }
  };
  
  // Touch-Event-Handler für Swipe-Gesten
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwiping(true);
  };
  
  const onTouchMove = (e) => {
    if (!swiping) return;
    setTouchEnd(e.targetTouches[0].clientX);
    
    // Karte während des Swipes bewegen
    if (cardRef.current && touchStart !== null) {
      const distance = e.targetTouches[0].clientX - touchStart;
      cardRef.current.style.transform = `translateX(${distance}px)`;
    }
  };
  
  const onTouchEnd = () => {
    setSwiping(false);
    
    if (!touchStart || !touchEnd) {
      // Karte zurücksetzen, wenn kein vollständiger Swipe
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.3s ease';
        cardRef.current.style.transform = 'translateX(0)';
        setTimeout(() => {
          if (cardRef.current) {
            cardRef.current.style.transition = 'none';
          }
        }, 300);
      }
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      handleLike(false); // Dislike
    } else if (isRightSwipe) {
      handleLike(true); // Like
    } else {
      // Karte zurücksetzen, wenn Swipe nicht weit genug
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.3s ease';
        cardRef.current.style.transform = 'translateX(0)';
        setTimeout(() => {
          if (cardRef.current) {
            cardRef.current.style.transition = 'none';
          }
        }, 300);
      }
    }
  };
  
  // Details anzeigen
  const showMovieDetails = (movie) => {
    setCurrentMovieDetails(movie);
    setShowDetails(true);
  };
  
  // Wenn keine Filme mehr vorhanden sind
  const renderNoMovies = () => (
    <Box sx={{ textAlign: 'center', p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Keine weiteren Filme zum Bewerten
      </Typography>
      <Button 
        variant="contained" 
        color="primary"
        onClick={loadMovies}
      >
        Neu laden
      </Button>
    </Box>
  );
  
  // Render Cards
  const renderCurrentMovie = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (movies.length === 0 || currentIndex >= movies.length) {
      return renderNoMovies();
    }
    
    const movie = movies[currentIndex];
    
    // Karte mit der MatchMovieCard-Komponente rendern
    return (
      <Box 
        ref={cardRef}
        sx={{ 
          maxWidth: 500, 
          margin: '0 auto',
          transition: 'transform 0.5s ease'
        }}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
      >
        <MatchMovieCard 
          movie={movie}
          onShowDetails={showMovieDetails}
        />
        
        {!isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: 'rgba(0, 0, 0, 0.3)', borderRadius: '0 0 16px 16px', mt: -1 }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<CloseIcon />}
              onClick={() => handleLike(false)}
              sx={{ borderRadius: 8 }}
            >
              Nein
            </Button>
            
            <Button
              variant="contained"
              color="success"
              endIcon={<FavoriteIcon />}
              onClick={() => handleLike(true)}
              sx={{ borderRadius: 8 }}
            >
              Ja
            </Button>
          </Box>
        )}
      </Box>
    );
  };
  
  // Matches rendern
  const renderMatches = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Eure Matches ({matches.length})
      </Typography>
      
      {matches.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Noch keine Matches gefunden. Swiped weiter, um gemeinsame Filme zu finden.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {matches.map(match => (
            <Grid item xs={6} sm={4} md={3} key={match.id}>
              <MatchMovieCard 
                movie={match}
                onShowDetails={showMovieDetails}
                isMatchListItem={true}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
  
  return (
    <Box sx={{ p: 2, maxWidth: 1000, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h1">
          Match #{matchId} - Filme bewerten
        </Typography>
      </Box>
      
      {renderCurrentMovie()}
      
      <Divider sx={{ my: 3 }} />
      
      {renderMatches()}
      
      {/* Mobile Action Buttons */}
      {isMobile && movies.length > 0 && currentIndex < movies.length && (
        <Box 
          sx={{ 
            position: 'fixed', 
            bottom: 16, 
            left: 0, 
            right: 0,
            display: 'flex', 
            justifyContent: 'center', 
            gap: 4
          }}
        >
          <IconButton
            sx={{ 
              backgroundColor: 'error.main',
              color: 'white',
              boxShadow: 3,
              p: 2,
              '&:hover': { backgroundColor: 'error.dark' }
            }}
            onClick={() => handleLike(false)}
          >
            <CloseIcon fontSize="large" />
          </IconButton>
          
          <IconButton
            sx={{
              backgroundColor: 'success.main',
              color: 'white',
              boxShadow: 3,
              p: 2,
              '&:hover': { backgroundColor: 'success.dark' }
            }}
            onClick={() => handleLike(true)}
          >
            <FavoriteIcon fontSize="large" />
          </IconButton>
        </Box>
      )}
      
      {/* Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'transparent', boxShadow: 'none', overflow: 'hidden' }
        }}
      >
        {currentMovieDetails && (
          <WatchlistDetail
            detailModalOpen={showDetails}
            handleCloseDetail={() => setShowDetails(false)}
            selectedItem={currentMovieDetails}
            status={currentMovieDetails.status || ''}
            setStatus={() => {}}
            abbruchGrund={currentMovieDetails.abbruch_grund || ''}
            setAbbruchGrund={() => {}}
            rating={currentMovieDetails.rating || 0}
            setRating={() => {}}
            notes={currentMovieDetails.notes || ''}
            setNotes={() => {}}
            tags={currentMovieDetails.tags || []}
            setTags={() => {}}
            tagInput={''}
            setTagInput={() => {}}
            tagColor={''}
            setTagColor={() => {}}
            allTags={[]}
            handleAddTag={() => {}}
            handleSaveDetail={() => {}}
            isPrivate={currentMovieDetails.is_private || false}
            setIsPrivate={() => {}}
            readOnly={true}
          />
        )}
      </Dialog>
    </Box>
  );
};

export default MatchSwipe; 