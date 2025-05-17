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
  title,
  username,
  onBack,
  onExplore,
  onSettings,
  isAdmin
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
      
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{
          color: '#00ff9d',
          mb: 4,
          '&:hover': {
            backgroundColor: 'rgba(0, 255, 157, 0.1)'
          }
        }}
      >
        Zurück zur Übersicht
      </Button>

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
          {title}
        </Typography>
        
        <Box>
          {isAdmin && (
            <IconButton
              onClick={onSettings}
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
            </IconButton>
          )}
          
          <Button
            variant="outlined"
            startIcon={<ExploreIcon />}
            onClick={onExplore}
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