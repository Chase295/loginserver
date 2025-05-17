import React from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
  FormControlLabel
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import BlockIcon from '@mui/icons-material/Block';

const WatchlistFilter = ({
  filterOpen,
  setFilterOpen,
  filterStatus,
  setFilterStatus,
  filterTags,
  setFilterTags,
  allTags,
  privacyFilter,
  setPrivacyFilter
}) => {
  return (
    <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Filter</DialogTitle>
      <DialogContent>
        {/* Privacy Filter */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#fff' }}>Privatsphäre</Typography>
          <RadioGroup
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            sx={{
              '& .MuiFormControlLabel-root': {
                marginLeft: 0,
                marginRight: 0,
                marginBottom: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              },
              '& .MuiRadio-root': {
                color: '#fff',
                '&.Mui-checked': {
                  color: '#ff0062'
                }
              }
            }}
          >
            <FormControlLabel
              value="all"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PublicIcon sx={{ color: '#00ff9d', fontSize: '1.2rem' }} />
                  <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>Alle Titel anzeigen</Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="private"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LockIcon sx={{ color: '#ff0062', fontSize: '1.2rem' }} />
                  <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>Nur private Titel</Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="public"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BlockIcon sx={{ color: '#00b7ff', fontSize: '1.2rem' }} />
                  <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>Alle außer private Titel</Typography>
                </Box>
              }
            />
          </RadioGroup>
        </Box>

        {/* Status Filter */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#fff' }}>Status</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {[
              { key: 'gesehen', label: 'Gesehen', icon: <CheckCircleIcon sx={{ color: '#00ff9d' }} /> },
              { key: 'am_schauen', label: 'Am Schauen', icon: <PlayCircleFilledWhiteIcon sx={{ color: '#00b7ff' }} /> },
              { key: 'abgebrochen', label: 'Abgebrochen', icon: <PauseCircleFilledIcon sx={{ color: '#ff0062' }} /> },
              { key: 'watchlist', label: 'Watchlist', icon: <WatchLaterIcon sx={{ color: '#fff' }} /> }
            ].map(stat => (
              <Box
                key={stat.key}
                onClick={() => setFilterStatus(prev => prev.includes(stat.key) ? prev.filter(s => s !== stat.key) : [...prev, stat.key])}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  background: filterStatus.includes(stat.key)
                    ? (stat.key === 'gesehen' ? 'rgba(0,255,157,0.13)' :
                      stat.key === 'am_schauen' ? 'rgba(0,183,255,0.13)' :
                      stat.key === 'abgebrochen' ? 'rgba(255,0,98,0.13)' :
                      'rgba(255,255,255,0.10)')
                    : 'rgba(255,255,255,0.05)',
                  color: filterStatus.includes(stat.key)
                    ? (stat.key === 'gesehen' ? '#00ff9d' :
                      stat.key === 'am_schauen' ? '#00b7ff' :
                      stat.key === 'abgebrochen' ? '#ff0062' :
                      '#fff')
                    : '#bbb',
                  border: filterStatus.includes(stat.key)
                    ? `2px solid ${
                        stat.key === 'gesehen' ? '#00ff9d' :
                        stat.key === 'am_schauen' ? '#00b7ff' :
                        stat.key === 'abgebrochen' ? '#ff0062' :
                        '#fff'
                      }` : '2px solid rgba(255,255,255,0.10)',
                  boxShadow: filterStatus.includes(stat.key)
                    ? `0 0 12px 2px ${
                        stat.key === 'gesehen' ? '#00ff9d33' :
                        stat.key === 'am_schauen' ? '#00b7ff33' :
                        stat.key === 'abgebrochen' ? '#ff006233' :
                        '#fff3'
                      }` : 'none',
                  transition: 'all 0.2s',
                  '&:hover': {
                    background: 'rgba(0,255,157,0.08)',
                    color: '#00ff9d',
                    borderColor: '#00ff9d',
                  }
                }}
              >
                {stat.icon}
                <span>{stat.label}</span>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Tags Filter */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#fff' }}>Tags</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {allTags.map((tag) => (
              <Chip
                key={tag.label}
                label={tag.label}
                onClick={() => {
                  if (filterTags.some(t => t.label === tag.label)) {
                    setFilterTags(filterTags.filter(t => t.label !== tag.label));
                  } else {
                    setFilterTags([...filterTags, tag]);
                  }
                }}
                sx={{
                  bgcolor: filterTags.some(t => t.label === tag.label)
                    ? (tag.color || 'rgba(255,255,255,0.1)')
                    : 'rgba(255,255,255,0.05)',
                  color: filterTags.some(t => t.label === tag.label)
                    ? '#fff'
                    : '#bbb',
                  border: filterTags.some(t => t.label === tag.label)
                    ? `2px solid ${tag.color || '#fff'}`
                    : '2px solid rgba(255,255,255,0.1)',
                  '&:hover': {
                    bgcolor: tag.color || 'rgba(255,255,255,0.1)',
                    color: '#fff'
                  }
                }}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={() => { 
            setFilterStatus([]); 
            setFilterTags([]); 
            setPrivacyFilter('all');
          }} 
          color="secondary"
        >
          Zurücksetzen
        </Button>
        <Button 
          onClick={() => setFilterOpen(false)} 
          variant="contained" 
          sx={{ 
            bgcolor: '#00ff9d', 
            color: '#0a1929', 
            fontWeight: 'bold', 
            borderRadius: 2, 
            px: 3, 
            boxShadow: '0 2px 8px #00ff9d33', 
            '&:hover': { bgcolor: '#00cc7d' } 
          }}
        >
          Filter anwenden
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WatchlistFilter; 