import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  TextField,
  Fade,
  Modal,
  Rating,
  FormControlLabel,
  Switch
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import StarIcon from '@mui/icons-material/Star';
import TvIcon from '@mui/icons-material/Tv';
import MovieIcon from '@mui/icons-material/Movie';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import AddIcon from '@mui/icons-material/Add';

const WatchlistDetail = ({
  open,
  onClose,
  selectedItem,
  status,
  setStatus,
  abbruchGrund,
  setAbbruchGrund,
  rating,
  setRating,
  notes,
  setNotes,
  tags,
  setTags,
  tagInput,
  setTagInput,
  tagColor,
  setTagColor,
  allTags,
  setAllTags,
  onSave,
  isEdit,
  readOnly,
  isPrivate,
  setIsPrivate,
  hidePrivateSwitch = false,
  isGroupWatchlist = false
}) => {
  if (!selectedItem) return null;

  // Status-Konfiguration für Icons und Farben
  const statusConfig = {
    gesehen: {
      label: 'Gesehen',
      color: 'rgba(0,255,157,0.25)',
      text: '#00ff9d',
      icon: <CheckCircleIcon sx={{ color: '#00ff9d' }} />
    },
    am_schauen: {
      label: 'Am Schauen',
      color: 'rgba(0,183,255,0.25)',
      text: '#00b7ff',
      icon: <PlayCircleFilledWhiteIcon sx={{ color: '#00b7ff' }} />
    },
    abgebrochen: {
      label: 'Abgebrochen',
      color: 'rgba(255,0,98,0.25)',
      text: '#ff0062',
      icon: <PauseCircleFilledIcon sx={{ color: '#ff0062' }} />
    },
    watchlist: {
      label: 'Watchlist',
      color: 'rgba(255,255,255,0.10)',
      text: '#fff',
      icon: <WatchLaterIcon sx={{ color: '#fff' }} />
    }
  };

  // Hilfsfunktion für verfügbare Tags
  const availableTags = allTags.filter(tag => {
    // Wenn wir in einer Gruppen-Watchlist sind, zeige nur öffentliche Tags
    if (isGroupWatchlist) {
      return !tag.is_private && !tags.some(t => t.label === tag.label);
    }
    // In der privaten Watchlist zeige private Tags des Users und öffentliche Tags
    return (tag.is_private ? tag.user_id === localStorage.getItem('userId') : true) && 
           !tags.some(t => t.label === tag.label);
  });

  const handleAddNewTag = (newTagInput, newTagColor) => {
    if (newTagInput.trim()) {
      const newTag = { 
        label: newTagInput.trim(), 
        color: newTagColor,
        is_private: !isGroupWatchlist, // Private Tags nur für private Watchlist
        user_id: localStorage.getItem('userId') // Speichere die User-ID für private Tags
      };
      
      // Füge den Tag zur lokalen Liste hinzu
      setTags([...tags, newTag]);
      
      // Füge den Tag zur globalen Liste hinzu, wenn er noch nicht existiert
      if (setAllTags && !allTags.some(tag => tag.label === newTag.label)) {
        setAllTags([...allTags, newTag]);
      }
      
      // Setze Input zurück
      setTagInput('');
      setTagColor('#2196f3');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropProps={{ timeout: 500, sx: { backdropFilter: 'blur(5px)' } }}
    >
      <Fade in={open}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '95%', sm: '90%', md: '80%', lg: '70%' },
          maxHeight: '90vh',
          overflow: 'auto',
          bgcolor: 'rgba(14, 17, 23, 0.95)',
          borderRadius: '16px',
          boxShadow: 24,
          p: { xs: 2, sm: 4 },
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(136, 136, 136, 0.5)',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(136, 136, 136, 0.8)',
          }
        }}>
          {selectedItem && (
            <>
              {/* Schließen-Button */}
              <IconButton 
                onClick={onClose}
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  color: 'white',
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 10,
                  '&:hover': {
                    bgcolor: 'rgba(255, 0, 0, 0.7)',
                  }
                }}
              >
                <CloseIcon />
              </IconButton>
              {/* Backdrop als Hintergrund mit Farbverlauf-Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '40vh',
                  backgroundImage: selectedItem.backdrop_path 
                    ? `url(https://image.tmdb.org/t/p/original${selectedItem.backdrop_path})` 
                    : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(0deg, rgba(14, 17, 23, 1) 0%, rgba(14, 17, 23, 0.7) 60%, rgba(14, 17, 23, 0.4) 100%)',
                  }
                }}
              />
              {/* Content-Container */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' },
                position: 'relative',
                zIndex: 2,
                gap: 4,
                pt: '10vh', 
              }}>
                {/* Poster */}
                <Box sx={{ 
                  flexShrink: 0, 
                  width: { xs: '100%', sm: '300px' },
                  maxWidth: { xs: '70%', sm: '300px' },
                  alignSelf: { xs: 'center', md: 'flex-start' },
                  transform: { xs: 'translateY(-30px)', md: 'translateY(0)' },
                  position: 'relative',
                }}>
                  <Box 
                    component="img"
                    src={selectedItem.poster_path 
                      ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}` 
                      : (selectedItem.poster_url || 'https://via.placeholder.com/345x300')}
                    alt={selectedItem.title || selectedItem.name}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      objectFit: 'cover',
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                      border: '2px solid rgba(255, 255, 255, 0.1)'
                    }}
                  />
                  {selectedItem.vote_average > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -15,
                        right: -15,
                        bgcolor: 
                          selectedItem.vote_average >= 8 ? 'rgba(116, 0, 184, 0.9)' : 
                          selectedItem.vote_average >= 7 ? 'rgba(0, 128, 128, 0.9)' : 
                          selectedItem.vote_average >= 6 ? 'rgba(255, 152, 0, 0.9)' : 
                          selectedItem.vote_average >= 5 ? 'rgba(66, 66, 66, 0.9)' : 
                          'rgba(211, 47, 47, 0.9)',
                        color: 'white',
                        p: 1,
                        borderRadius: '50%',
                        width: 60,
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                        border: '2px solid rgba(255, 255, 255, 0.3)'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <StarIcon fontSize="small" />
                        <span>{Math.round(selectedItem.vote_average * 10) / 10}</span>
                      </Box>
                    </Box>
                  )}
                </Box>
                <Box sx={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2,
                }}>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 'bold',
                      background: 'linear-gradient(45deg, #00aeff, #a68eff)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    {selectedItem.title || selectedItem.name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Chip 
                      icon={<CalendarMonthIcon />}
                      label={selectedItem.release_date 
                        ? new Date(selectedItem.release_date).getFullYear() 
                        : selectedItem.first_air_date 
                          ? new Date(selectedItem.first_air_date).getFullYear() 
                          : 'Unbekannt'
                      }
                      size="small"
                      sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
                    />
                    <Chip 
                      icon={selectedItem.media_type === 'tv' ? <TvIcon /> : <MovieIcon />}
                      label={selectedItem.media_type === 'tv' ? 'Serie' : 'Film'}
                      size="small"
                      sx={{ 
                        bgcolor: selectedItem.media_type === 'tv' 
                          ? 'rgba(66, 133, 244, 0.7)' 
                          : 'rgba(230, 81, 0, 0.7)', 
                        color: 'white' 
                      }}
                    />
                  </Box>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                      Handlung
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {selectedItem.overview || 'Keine Beschreibung verfügbar.'}
                    </Typography>
                  </Box>
                  {selectedItem.media_type === 'tv' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                        Seriendetails
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                            Status:
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                            {selectedItem.status_de || 'Unbekannt'}
                            {selectedItem.in_production && ' (In Produktion)'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                            Staffeln:
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                            {selectedItem.number_of_seasons || 'Unbekannt'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                            Folgen:
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                            {selectedItem.number_of_episodes || 'Unbekannt'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                            Erstausstrahlung:
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                            {selectedItem.first_air_date 
                              ? new Date(selectedItem.first_air_date).toLocaleDateString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })
                              : 'Unbekannt'
                            }
                          </Typography>
                        </Box>
                        {/* TMDB Bewertung */}
                        {selectedItem.vote_average > 0 && (
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                              TMDB Bewertung:
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <StarIcon sx={{ 
                                color: selectedItem.vote_average >= 8 ? '#ffd700' : 
                                       selectedItem.vote_average >= 7 ? '#00ff9d' : 
                                       selectedItem.vote_average >= 6 ? '#ffc107' : 
                                       selectedItem.vote_average >= 5 ? '#ff9800' : 
                                       '#ff5722',
                                fontSize: '1.2rem'
                              }} />
                              <Typography variant="body2" sx={{ 
                                color: selectedItem.vote_average >= 8 ? '#ffd700' : 
                                       selectedItem.vote_average >= 7 ? '#00ff9d' : 
                                       selectedItem.vote_average >= 6 ? '#ffc107' : 
                                       selectedItem.vote_average >= 5 ? '#ff9800' : 
                                       '#ff5722',
                                fontWeight: 'bold'
                              }}>
                                {Math.round(selectedItem.vote_average * 10) / 10}/10
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                  {selectedItem.media_type === 'movie' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                        Filmdetails
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.6)' }}>
                            Erscheinungsdatum:
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                            {selectedItem.release_date 
                              ? new Date(selectedItem.release_date).toLocaleDateString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })
                              : 'Unbekannt'
                            }
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  {/* Status-Auswahl wie Discovery */}
                  <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>Status</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {[
                        { key: 'gesehen', label: 'Gesehen', icon: <CheckCircleIcon sx={{ color: '#00ff9d' }} /> },
                        { key: 'am_schauen', label: 'Am Schauen', icon: <PlayCircleFilledWhiteIcon sx={{ color: '#00b7ff' }} /> },
                        { key: 'abgebrochen', label: 'Abgebrochen', icon: <PauseCircleFilledIcon sx={{ color: '#ff0062' }} /> },
                        { key: 'watchlist', label: 'Watchlist', icon: <WatchLaterIcon sx={{ color: '#fff' }} /> }
                      ].map(stat => (
                        <Box
                          key={stat.key}
                          onClick={readOnly ? undefined : () => setStatus(stat.key)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 2.5,
                            py: 1.2,
                            borderRadius: 999,
                            fontWeight: 600,
                            fontSize: '1.05rem',
                            cursor: readOnly ? 'not-allowed' : 'pointer',
                            background: status === stat.key
                              ? (stat.key === 'gesehen' ? 'rgba(0,255,157,0.13)' :
                                stat.key === 'am_schauen' ? 'rgba(0,183,255,0.13)' :
                                stat.key === 'abgebrochen' ? 'rgba(255,0,98,0.13)' :
                                'rgba(255,255,255,0.10)')
                              : 'rgba(255,255,255,0.05)',
                            color: status === stat.key
                              ? (stat.key === 'gesehen' ? '#00ff9d' :
                                stat.key === 'am_schauen' ? '#00b7ff' :
                                stat.key === 'abgebrochen' ? '#ff0062' :
                                '#fff')
                              : '#bbb',
                            border: status === stat.key
                              ? `2px solid ${
                                  stat.key === 'gesehen' ? '#00ff9d' :
                                  stat.key === 'am_schauen' ? '#00b7ff' :
                                  stat.key === 'abgebrochen' ? '#ff0062' :
                                  '#fff'
                                }` : '2px solid rgba(255,255,255,0.10)',
                            boxShadow: status === stat.key
                              ? `0 0 16px 2px ${
                                  stat.key === 'gesehen' ? '#00ff9d33' :
                                  stat.key === 'am_schauen' ? '#00b7ff33' :
                                  stat.key === 'abgebrochen' ? '#ff006233' :
                                  '#fff3'
                                }` : 'none',
                            transition: 'all 0.2s',
                            pointerEvents: readOnly ? 'none' : 'auto',
                            opacity: readOnly ? 0.6 : 1
                          }}
                        >
                          {stat.icon}
                          <span>{stat.label}</span>
                        </Box>
                      ))}
                    </Box>
                    {status === 'abgebrochen' && (
                      <TextField label="Abbruch-Grund" value={abbruchGrund} onChange={e => setAbbruchGrund(e.target.value)} fullWidth variant="outlined" disabled={readOnly} />
                    )}
                    {/* Bewertung */}
                    <Box>
                      <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>Bewertung</Typography>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 2,
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.05)',
                        boxShadow: rating > 0 ? '0 0 10px 2px rgba(255,215,0,0.2)' : 'none',
                        transition: 'box-shadow 0.3s',
                      }}>
                        <Rating
                          name="movie-rating"
                          value={Number(rating)}
                          max={10}
                          onChange={(event, newValue) => {
                            console.log('Altes Rating:', rating);
                            console.log('Neues Rating:', newValue);
                            setRating(newValue === null ? 0 : newValue);
                          }}
                          sx={{
                            '& .MuiRating-iconFilled': {
                              color: '#FFD700',
                            },
                            '& .MuiRating-iconHover': {
                              color: '#FFEB3B',
                            },
                            '& .MuiRating-icon': {
                              filter: rating > 0 ? 'drop-shadow(0 0 3px rgba(255,215,0,0.7))' : 'none'
                            }
                          }}
                          readOnly={readOnly}
                          disabled={readOnly}
                        />
                        <Typography sx={{ ml: 2, color: rating > 0 ? '#FFD700' : '#999' }}>
                          {Number(rating)}/10
                        </Typography>
                      </Box>
                    </Box>
                    {/* Notizen */}
                    <TextField label="Notizen" value={notes} onChange={e => setNotes(e.target.value)} fullWidth multiline minRows={2} variant="outlined" disabled={readOnly} />
                    {/* Tags 3-reihig wie Discovery */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.9)' }}>Tags</Typography>
                      {/* 1. Reihe: Aktive Tags */}
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5, mb: 0.5, fontWeight: 500 }}>Vergebene Tags für diesen Titel</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {tags.map((tag, idx) => (
                          <Chip
                            key={tag.label + tag.color + idx}
                            label={tag.label}
                            icon={<Box sx={{ background: tag.color, borderRadius: '50%', width: 14, height: 14, display: 'inline-block', marginRight: 4 }} />}
                            onDelete={readOnly ? undefined : () => setTags(tags.filter((_, i) => i !== idx))}
                            sx={{
                              bgcolor: 'rgba(20,20,35,0.8)',
                              color: tag.color,
                              fontWeight: 'bold',
                              borderRadius: 50,
                              px: 1.5,
                              mb: 0.5,
                              border: `1px solid ${tag.color}55`,
                              boxShadow: `0 2px 8px 0 ${tag.color}22`,
                              mr: 0.5,
                              fontSize: '0.9rem',
                              textShadow: `0 0 6px ${tag.color}99`,
                              transition: 'all 0.2s',
                              pointerEvents: readOnly ? 'none' : 'auto',
                              opacity: readOnly ? 0.6 : 1
                            }}
                          />
                        ))}
                      </Box>
                      {/* 2. Reihe: Vorschlags-Tags */}
                      {!readOnly && (
                        <>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', ml: 0.5, mb: 0.5, fontWeight: 400 }}>Deine bisherigen Tags (zum Hinzufügen anklicken)</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                            {availableTags.map((tag, idx) => (
                              <Chip
                                key={tag.label + tag.color + idx}
                                label={tag.label}
                                icon={<Box sx={{ background: tag.color, borderRadius: '50%', width: 14, height: 14, display: 'inline-block', marginRight: 4 }} />}
                                onClick={readOnly ? undefined : () => setTags([...tags, tag])}
                                sx={{
                                  bgcolor: 'rgba(20,20,35,0.5)',
                                  color: tag.color,
                                  fontWeight: 'bold',
                                  borderRadius: 50,
                                  px: 1.5,
                                  mb: 0.5,
                                  border: `1px solid ${tag.color}55`,
                                  boxShadow: `0 2px 8px 0 ${tag.color}22`,
                                  mr: 0.5,
                                  fontSize: '0.9rem',
                                  textShadow: `0 0 6px ${tag.color}99`,
                                  transition: 'all 0.2s',
                                  cursor: readOnly ? 'not-allowed' : 'pointer',
                                  pointerEvents: readOnly ? 'none' : 'auto',
                                  opacity: readOnly ? 0.6 : 1
                                }}
                              />
                            ))}
                          </Box>
                        </>
                      )}
                      {/* 3. Reihe: Neuen Tag erstellen */}
                      {!readOnly && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <Box 
                            sx={{
                              position: 'relative',
                              width: 44,
                              height: 44,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: readOnly ? 'not-allowed' : 'pointer',
                              pointerEvents: readOnly ? 'none' : 'auto',
                              opacity: readOnly ? 0.6 : 1
                            }}
                            onClick={readOnly ? undefined : () => { document.getElementById('color-picker').click(); }}
                          >
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: tagColor,
                                boxShadow: `0 0 10px 2px ${tagColor}55`,
                                border: '2.5px solid #fff',
                                transition: 'box-shadow 0.2s, border 0.2s',
                              }}
                            />
                            <input 
                              id="color-picker"
                              type="color" 
                              value={tagColor} 
                              onChange={readOnly ? undefined : e => setTagColor(e.target.value)} 
                              style={{ 
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                opacity: 0,
                                cursor: readOnly ? 'not-allowed' : 'pointer',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                zIndex: 2
                              }} 
                              tabIndex={-1}
                              disabled={readOnly}
                              readOnly={readOnly}
                            />
                          </Box>
                          <TextField
                            variant="outlined"
                            placeholder="Neuen Tag erstellen..."
                            size="small"
                            value={tagInput}
                            onChange={readOnly ? undefined : e => setTagInput(e.target.value)}
                            onKeyDown={readOnly ? undefined : e => {
                              if (e.key === 'Enter') {
                                handleAddNewTag(tagInput, tagColor);
                                e.preventDefault();
                              }
                            }}
                            sx={{ minWidth: 180 }}
                            disabled={readOnly}
                            inputProps={{ readOnly: readOnly }}
                          />
                          <Button 
                            variant="contained"
                            onClick={readOnly ? undefined : () => handleAddNewTag(tagInput, tagColor)}
                            sx={{
                              borderRadius: 2,
                              px: 2,
                              py: 1,
                              minWidth: '50px',
                              height: '40px',
                              background: `linear-gradient(45deg, ${tagColor}, ${tagColor}aa)`,
                              boxShadow: `0 4px 15px ${tagColor}55`,
                              '&:hover': {
                                background: `linear-gradient(45deg, ${tagColor}, ${tagColor})`,
                                boxShadow: `0 6px 20px ${tagColor}77`
                              }
                            }}
                            disabled={readOnly}
                          >
                            <AddIcon />
                          </Button>
                        </Box>
                      )}
                    </Box>
                    {/* Privat/Öffentlich-Schalter und Speichern-Button in einer Box */}
                    <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {/* Privat/Öffentlich-Schalter nur anzeigen, wenn nicht readOnly und nicht hidePrivateSwitch */}
                      {!readOnly && !hidePrivateSwitch && setIsPrivate && (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={isPrivate}
                              onChange={(e) => setIsPrivate(e.target.checked)}
                              color="secondary"
                            />
                          }
                          label={
                            <span style={{ 
                              color: isPrivate ? '#ff0062' : '#888', 
                              fontWeight: 600, 
                              fontSize: '1rem' 
                            }}>
                              {isPrivate ? '🔒 Privat' : '🔓 Öffentlich'}
                            </span>
                          }
                          labelPlacement="start"
                          sx={{ mr: 0 }}
                        />
                      )}
                      {/* Speichern-Button nur anzeigen, wenn nicht readOnly */}
                      {!readOnly && (
                        <Button
                          variant="contained"
                          onClick={onSave}
                          sx={{
                            py: 1.5,
                            px: 4,
                            borderRadius: 6,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            background: 'linear-gradient(45deg, #00ff9d, #00aeff)',
                            boxShadow: '0 8px 20px rgba(0, 255, 157, 0.3)',
                            transition: 'all 0.3s ease',
                            border: '2px solid rgba(255,255,255,0.1)',
                            color: '#000',
                            '&:hover': {
                              background: 'linear-gradient(45deg, #00ff9d, #00aeff)',
                              transform: 'translateY(-3px)',
                              boxShadow: '0 12px 25px rgba(0, 255, 157, 0.5)',
                            },
                            '&:active': {
                              transform: 'translateY(1px)',
                              boxShadow: '0 5px 15px rgba(0, 255, 157, 0.4)',
                            }
                          }}
                        >
                          {isEdit ? 'Speichern' : 'Zur Watchlist hinzufügen'}
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Fade>
    </Modal>
  );
};

export default WatchlistDetail; 