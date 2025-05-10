import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import axios from 'axios';

const Login = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8000/api/login', formData);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.username);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Ein Fehler ist aufgetreten');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1929 0%, #1a2027 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: isMobile ? 3 : 4,
            background: 'rgba(26, 32, 39, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              textAlign: 'center',
              mb: 4,
              background: 'linear-gradient(45deg, #00ff9d 30%, #ff00ff 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Anmelden
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="E-Mail"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: '#00ff9d',
                  },
                },
              }}
            />

            <TextField
              fullWidth
              label="Passwort"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: '#00ff9d',
                  },
                },
              }}
            />

            {error && (
              <Typography color="error" sx={{ mt: 2, textAlign: 'center' }}>
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{
                mt: 3,
                mb: 2,
                background: 'linear-gradient(45deg, #00ff9d 30%, #00cc7d 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #00cc7d 30%, #00ff9d 90%)',
                },
              }}
            >
              Anmelden
            </Button>

            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/register')}
              sx={{
                color: '#ff00ff',
                '&:hover': {
                  backgroundColor: 'rgba(255, 0, 255, 0.1)',
                },
              }}
            >
              Noch kein Konto? Registrieren
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login; 