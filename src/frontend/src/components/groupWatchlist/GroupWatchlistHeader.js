import React from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExploreIcon from '@mui/icons-material/Explore';
import SettingsIcon from '@mui/icons-material/Settings';

const GroupWatchlistHeader = ({
  groupName,
  username,
  navigate,
  setSettingsOpen,
  groupId
}) => {
  return (
    <>
      <Chip
        label={`Eingeloggt als: ${username}`}
        sx={{ 
          position: 'absolute', 
          top: 24, 
          right: 24, 
          bgcolor: '#00ff9d', 
          color: '#0a1929', 
          fontWeight: 700, 
          fontSize: 16, 
          px: 2, 
          boxShadow: 2, 
          zIndex: 10 
        }}
      />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton
          onClick={() => navigate('/dashboard')}
          sx={{
            color: '#00ff9d',
            mr: 2,
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 157, 0.1)'
            }
          }}
        >
          <ArrowBackIcon />
        </IconButton>
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
          {groupName || 'Gruppen-Watchlist'} 👥
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
            variant="outlined"
            startIcon={<ExploreIcon />}
            onClick={() => navigate(`/discover?groupId=${groupId}&groupName=${encodeURIComponent(groupName || 'Gruppe')}`)}
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

export default GroupWatchlistHeader; 