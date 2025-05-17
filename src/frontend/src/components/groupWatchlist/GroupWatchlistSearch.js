import React from 'react';
import {
  Box,
  TextField,
  Button
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

const GroupWatchlistSearch = ({
  searchTerm,
  setSearchTerm,
  fetchMovies,
  setFilterOpen,
  filterStatus,
  filterTags
}) => {
  return (
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
        {filterStatus.length > 0 || filterTags.length > 0 ? 'Filter aktiv' : 'Filter'}
      </Button>
    </Box>
  );
};

export default GroupWatchlistSearch; 