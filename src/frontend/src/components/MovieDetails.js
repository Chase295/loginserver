import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  Rating,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';
import { API_URL } from '../config';

const MovieDetails = ({ movie, onUpdate, onDelete, readOnly = false }) => {
  const [editMode, setEditMode] = useState(false);
  const [status, setStatus] = useState(movie.status || '');
  const [rating, setRating] = useState(movie.rating || 0);
  const [notes, setNotes] = useState(movie.notes || '');
  const [abbruchGrund, setAbbruchGrund] = useState(movie.abbruch_grund || '');
  const [isPrivate, setIsPrivate] = useState(movie.is_private || false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Format der Bewertung aus der TMDB-API (z.B. 7.5 von 10)
  const formatRating = (rating) => {
    if (!rating) return 'Keine Bewertung';
    return `${rating}/10`;
  };
  
  // Formatierung des Release-Datums oder Jahr
  const formatReleaseDate = (date, year) => {
    if (date) return new Date(date).toLocaleDateString();
    if (year) return year.toString();
    return 'Unbekannt';
  };
  
  // Film aktualisieren
  const handleSave = async () => {
    if (readOnly) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/watchlist/movies/${movie.id}`,
        {
          ...movie,
          status,
          rating,
          notes,
          abbruch_grund: abbruchGrund,
          is_private: isPrivate
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setEditMode(false);
      setSaving(false);
      
      // Parent-Komponente über Update informieren
      if (onUpdate) {
        onUpdate(response.data);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Films:', error);
      setSaving(false);
    }
  };
  
  // Film löschen
  const handleDelete = async () => {
    if (readOnly) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/watchlist/movies/${movie.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDeleteDialogOpen(false);
      
      // Parent-Komponente über Löschung informieren
      if (onDelete) {
        onDelete(movie.id);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Films:', error);
    }
  };
  
  return (
    <Box>
      <Grid container spacing={3}>
        {/* Poster und Hauptinfos */}
        <Grid item xs={12} sm={4}>
          <Box sx={{ position: 'relative' }}>
            <img
              src={movie.poster_url || 'https://via.placeholder.com/300x450?text=Kein+Bild'}
              alt={movie.title}
              style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
            />
            
            {!readOnly && (
              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                {!editMode ? (
                  <IconButton 
                    onClick={() => setEditMode(true)}
                    sx={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
                  >
                    <EditIcon />
                  </IconButton>
                ) : (
                  <IconButton 
                    onClick={() => setEditMode(false)}
                    sx={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
                  >
                    <CloseIcon />
                  </IconButton>
                )}
              </Box>
            )}
          </Box>
        </Grid>
        
        {/* Details */}
        <Grid item xs={12} sm={8}>
          <Typography variant="h4" component="h2" gutterBottom>
            {movie.title} {movie.year ? `(${movie.year})` : ''}
          </Typography>
          
          {/* TMDB-Infos */}
          <Box sx={{ mb: 2 }}>
            {movie.vote_average && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                TMDB-Bewertung: {formatRating(movie.vote_average)}
              </Typography>
            )}
            
            {movie.genres && movie.genres.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {movie.genres.map((genre, index) => (
                  <Chip 
                    key={index} 
                    label={genre.name || genre} 
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            )}
            
            {movie.media_type && (
              <Chip 
                label={movie.media_type === 'movie' ? 'Film' : 'Serie'} 
                size="small"
                color="primary"
                sx={{ mb: 1 }}
              />
            )}
          </Box>
          
          {/* Beschreibung */}
          <Typography variant="body1" sx={{ mb: 2 }}>
            {movie.overview || 'Keine Beschreibung verfügbar.'}
          </Typography>
          
          {/* User-Tags */}
          {movie.tags && movie.tags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Tags:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {movie.tags.map((tag, index) => (
                  <Chip 
                    key={index} 
                    label={tag.label} 
                    size="small" 
                    sx={{ 
                      backgroundColor: tag.color || '#2196f3',
                      color: 'white',
                      mr: 0.5,
                      mb: 0.5
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
          
          {/* User-spezifische Einstellungen im Bearbeitungsmodus */}
          {editMode ? (
            <Box sx={{ mt: 3 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <MenuItem value="">Nicht festgelegt</MenuItem>
                  <MenuItem value="to-watch">Will ich sehen</MenuItem>
                  <MenuItem value="watching">Schaue ich gerade</MenuItem>
                  <MenuItem value="completed">Abgeschlossen</MenuItem>
                  <MenuItem value="aborted">Abgebrochen</MenuItem>
                </Select>
              </FormControl>
              
              {status === 'aborted' && (
                <TextField
                  label="Grund für Abbruch"
                  fullWidth
                  multiline
                  rows={2}
                  value={abbruchGrund}
                  onChange={(e) => setAbbruchGrund(e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}
              
              <Box sx={{ mb: 2 }}>
                <Typography component="legend">Deine Bewertung:</Typography>
                <Rating
                  name="user-rating"
                  value={rating}
                  onChange={(event, newValue) => {
                    setRating(newValue);
                  }}
                  max={10}
                />
              </Box>
              
              <TextField
                label="Notizen"
                fullWidth
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                sx={{ mb: 2 }}
              />
              
              <FormControlLabel
                control={
                  <Switch 
                    checked={isPrivate} 
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                }
                label="Privat (nur für dich sichtbar)"
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Löschen
                </Button>
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Wird gespeichert...' : 'Speichern'}
                </Button>
              </Box>
            </Box>
          ) : (
            /* Anzeige im nicht-Bearbeitungsmodus */
            <Box sx={{ mt: 3 }}>
              {status && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Status:</strong> {
                    status === 'to-watch' ? 'Will ich sehen' :
                    status === 'watching' ? 'Schaue ich gerade' :
                    status === 'completed' ? 'Abgeschlossen' :
                    status === 'aborted' ? 'Abgebrochen' : status
                  }
                </Typography>
              )}
              
              {status === 'aborted' && abbruchGrund && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Grund für Abbruch:</strong> {abbruchGrund}
                </Typography>
              )}
              
              {rating > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography component="legend" variant="body2">
                    <strong>Deine Bewertung:</strong>
                  </Typography>
                  <Rating
                    name="read-only-rating"
                    value={rating}
                    readOnly
                    max={10}
                  />
                </Box>
              )}
              
              {notes && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Notizen:</strong> {notes}
                </Typography>
              )}
              
              {!readOnly && (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  <strong>Sichtbarkeit:</strong> {isPrivate ? 'Privat' : 'Öffentlich'}
                </Typography>
              )}
            </Box>
          )}
        </Grid>
      </Grid>
      
      {/* Lösch-Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Film löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchtest du "{movie.title}" wirklich aus deiner Watchlist entfernen? Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Abbrechen
          </Button>
          <Button onClick={handleDelete} color="error">
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MovieDetails; 