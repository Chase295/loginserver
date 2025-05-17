import React from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Autocomplete,
  TextField
} from '@mui/material';

const WatchlistSettings = ({
  settingsOpen,
  setSettingsOpen,
  settingsTab,
  setSettingsTab,
  profileVisibility,
  setProfileVisibility,
  allTags,
  privateTags,
  setPrivateTags,
  privateTitles,
  setPrivateTitles,
  movies,
  saveWatchlistSettings
}) => {
  return (
    <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0a1929', color: '#00ff9d', fontWeight: 700, textAlign: 'center' }}>Profileinstellungen</DialogTitle>
      <Tabs value={settingsTab} onChange={(_, v) => setSettingsTab(v)} sx={{ bgcolor: '#1a2233', color: '#00ff9d', px: 2 }}>
        <Tab label="Sichtbarkeit" sx={{ color: settingsTab === 0 ? '#00ff9d' : '#fff' }} />
        <Tab label="Ausnahmen" sx={{ color: settingsTab === 1 ? '#00ff9d' : '#fff' }} />
      </Tabs>
      {settingsTab === 0 && (
        <DialogContent sx={{ bgcolor: '#1a2233', color: '#fff', p: 4 }}>
          <FormLabel component="legend" sx={{ color: '#00ff9d', fontWeight: 600, mb: 2 }}>Wer kann dein Profil sehen?</FormLabel>
          <RadioGroup
            value={profileVisibility}
            onChange={e => setProfileVisibility(e.target.value)}
            sx={{ gap: 2 }}
          >
            <FormControlLabel value="public" control={<Radio sx={{ color: '#00ff9d' }} />} label={<span style={{ color: '#fff' }}>Jeder</span>} />
            <FormControlLabel value="friends" control={<Radio sx={{ color: '#00ff9d' }} />} label={<span style={{ color: '#fff' }}>Nur Freunde</span>} />
            <FormControlLabel value="private" control={<Radio sx={{ color: '#00ff9d' }} />} label={<span style={{ color: '#fff' }}>Niemand</span>} />
          </RadioGroup>
        </DialogContent>
      )}
      {settingsTab === 1 && (
        <DialogContent sx={{ bgcolor: '#1a2233', color: '#fff', p: 4 }}>
          <Typography sx={{ color: '#00ff9d', fontWeight: 600, mb: 2 }}>Ausnahmen: Diese Tags und Titel sind immer privat</Typography>
          <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>Tags</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {allTags.map((tag, idx) => (
              <Chip
                key={tag.label + tag.color + idx}
                label={tag.label}
                icon={<Box sx={{ background: tag.color, borderRadius: '50%', width: 14, height: 14, display: 'inline-block', marginRight: 4 }} />}
                clickable
                onClick={() => setPrivateTags(prev => prev.some(t => t.label === tag.label && t.color === tag.color) ? prev.filter(t => !(t.label === tag.label && t.color === tag.color)) : [...prev, tag])}
                sx={{
                  bgcolor: privateTags.some(t => t.label === tag.label && t.color === tag.color) ? tag.color + '22' : 'rgba(20,20,35,0.3)',
                  color: privateTags.some(t => t.label === tag.label && t.color === tag.color) ? '#fff' : tag.color,
                  fontWeight: 'bold',
                  borderRadius: 50,
                  px: 1.5,
                  mb: 0.5,
                  border: privateTags.some(t => t.label === tag.label && t.color === tag.color) ? `2.5px solid ${tag.color}` : `1px solid ${tag.color}55`,
                  boxShadow: privateTags.some(t => t.label === tag.label && t.color === tag.color) ? `0 0 12px 2px ${tag.color}55` : `0 2px 8px 0 ${tag.color}22`,
                  mr: 0.5,
                  fontSize: '0.9rem',
                  textShadow: privateTags.some(t => t.label === tag.label && t.color === tag.color) ? `0 0 8px #fff` : `0 0 6px ${tag.color}99`,
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: privateTags.some(t => t.label === tag.label && t.color === tag.color) ? tag.color + '33' : 'rgba(40,40,55,0.9)',
                    opacity: 1
                  }
                }}
              />
            ))}
          </Box>
          <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>Titel</Typography>
          <Autocomplete
            multiple
            options={movies}
            value={privateTitles}
            onChange={(event, newValue) => setPrivateTitles(newValue)}
            getOptionLabel={(option) => option.title || option.name || ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Private Titel"
                placeholder="Wähle Titel aus..."
              />
            )}
          />
        </DialogContent>
      )}
      <DialogActions sx={{ bgcolor: '#1a2233', p: 2 }}>
        <Button onClick={() => setSettingsOpen(false)} sx={{ color: '#ff0062' }}>Abbrechen</Button>
        <Button onClick={async () => { await saveWatchlistSettings(); setSettingsOpen(false); }} sx={{ bgcolor: '#00ff9d', color: '#0a1929', fontWeight: 700 }}>Speichern</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WatchlistSettings; 