import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExploreIcon from '@mui/icons-material/Explore';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

const WatchlistHeader = ({
  username,
  navigate,
  searchTerm,
  setSearchTerm,
  fetchMovies,
  setFilterOpen,
  setSettingsOpen,
  handleOpenMultiplayer
}) => {
  return (
    <>
      <Chip
        label={`Eingeloggt als: ${username}`}
        sx={{ position: 'absolute', top: 24, right: 24, bgcolor: '#00ff9d', color: '#0a1929', fontWeight: 700, fontSize: 16, px: 2, boxShadow: 2, zIndex: 10 }}
      />
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/dashboard')}
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <TextField
          variant="outlined"
          placeholder="Titel suchen..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 260, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}
          onKeyDown={e => { if (e.key === 'Enter') fetchMovies(); }}
        />
        <Button
          variant="contained"
          onClick={fetchMovies}
          sx={{
            bgcolor: '#00ff9d',
            color: '#0a1929',
            fontWeight: 'bold',
            borderRadius: 2,
            px: 3,
            boxShadow: '0 2px 8px #00ff9d33',
            '&:hover': { bgcolor: '#00cc7d' }
          }}
          startIcon={<SearchIcon />}
        >
          Suchen
        </Button>
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={() => setFilterOpen(true)}
          sx={{
            color: '#00ff9d',
            borderColor: '#00ff9d',
            borderRadius: 2,
            fontWeight: 'bold',
            px: 2,
            '&:hover': { borderColor: '#00cc7d', background: 'rgba(0,255,157,0.08)' }
          }}
        >
          Filter
        </Button>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            color: '#00ff9d',
            textAlign: 'center',
            mb: 0
          }}
        >
          Meine Watchlist 📺
        </Typography>
        <Box>
          <Button
            onClick={() => setSettingsOpen(true)}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              mr: 1,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#00ff9d'
              }
            }}
          >
            <SettingsIcon />
          </Button>
          <Button
            onClick={handleOpenMultiplayer}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              mr: 1,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#00ff9d'
              }
            }}
          >
            <GroupIcon />
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExploreIcon />}
            onClick={() => navigate('/discover')}
            sx={{
              color: '#00ff9d',
              borderColor: '#00ff9d',
              '&:hover': {
                borderColor: '#00cc7d',
                backgroundColor: 'rgba(0, 255, 157, 0.1)'
              }
            }}
          >
            Entdecken
          </Button>
        </Box>
      </Box>
    </>
  );
};

export default WatchlistHeader; 