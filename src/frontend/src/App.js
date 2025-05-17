import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Welcome from './components/Welcome';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Watchlist from './components/Watchlist';
import FriendWatchlist from './components/FriendWatchlist';
import GroupWatchlist from './components/GroupWatchlist';
import Discover from './components/Discover';
import Freunde from './components/Freunde';
import MatchLobby from './components/MatchLobby';
import ActiveMatchGame from './components/ActiveMatchGame';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ff9d',
    },
    secondary: {
      main: '#ff00ff',
    },
    background: {
      default: '#0a1929',
      paper: '#1a2027',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3.5rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontSize: '1rem',
          padding: '10px 20px',
        },
      },
    },
  },
});

// Router-Konfiguration mit Future Flags
const router = createBrowserRouter([
  { path: "/", element: <Welcome /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/watchlist", element: <Watchlist /> },
  { path: "/watchlist/:username", element: <FriendWatchlist /> },
  { path: "/group-watchlist/:groupId", element: <GroupWatchlist /> },
  { path: "/discover", element: <Discover /> },
  { path: "/freunde", element: <Freunde /> },
  { path: "/match-lobby/:matchId", element: <MatchLobby /> },
  { path: "/match/:matchId/game", element: <ActiveMatchGame /> },
  { path: "*", element: <Navigate to="/" replace /> }
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App; 