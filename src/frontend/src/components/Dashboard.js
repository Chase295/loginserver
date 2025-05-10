import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  useTheme,
  useMediaQuery,
  Grid
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

const Dashboard = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const username = localStorage.getItem('username');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(45deg, #0a1929 30%, #1a2027 90%)',
        py: 4
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              color: '#00ff9d',
              textAlign: 'center',
              mb: 4
            }}
          >
            Willkommen, {username}! 👋
          </Typography>

          <Grid container spacing={3} justifyContent="center">
            <Grid item>
              <Button
                variant="contained"
                startIcon={<PlaylistAddIcon />}
                onClick={() => navigate('/watchlist')}
                sx={{
                  backgroundColor: '#00ff9d',
                  color: '#0a1929',
                  '&:hover': {
                    backgroundColor: '#00cc7d'
                  }
                }}
              >
                Meine Watchlist 📺
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  color: '#ff00ff',
                  borderColor: '#ff00ff',
                  '&:hover': {
                    borderColor: '#ff00ff',
                    backgroundColor: 'rgba(255, 0, 255, 0.1)'
                  }
                }}
              >
                Abmelden
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default Dashboard; 