import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #00ff9d 30%, #ff00ff 90%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textAlign: 'center',
}));

const Welcome = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1929 0%, #1a2027 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 255, 157, 0.1) 0%, transparent 50%)',
          animation: 'pulse 4s ease-in-out infinite',
        },
        '@keyframes pulse': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)' },
        },
      }}
    >
      <Container maxWidth="md">
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: isMobile ? 2 : 4,
          }}
        >
          <GradientText
            variant="h1"
            sx={{
              fontSize: isMobile ? '2.5rem' : '4rem',
              mb: 4,
              fontWeight: 700,
            }}
          >
            Willkommen in der Zukunft
          </GradientText>
          
          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              mb: 6,
              maxWidth: '600px',
              mx: 'auto',
            }}
          >
            Entdecken Sie eine neue Dimension der digitalen Erfahrung
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              flexDirection: isMobile ? 'column' : 'row',
            }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                background: 'linear-gradient(45deg, #00ff9d 30%, #00cc7d 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #00cc7d 30%, #00ff9d 90%)',
                },
              }}
            >
              Anmelden
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                borderColor: '#ff00ff',
                color: '#ff00ff',
                '&:hover': {
                  borderColor: '#ff00ff',
                  backgroundColor: 'rgba(255, 0, 255, 0.1)',
                },
              }}
            >
              Registrieren
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Welcome; 