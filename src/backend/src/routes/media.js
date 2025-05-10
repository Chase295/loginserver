const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const tmdbService = require('../services/tmdb');

// Middleware für Authentifizierung
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('Auth-Fehler:', err);
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
};

// Filme-Daten (Fallback)
const movieData = [
  {
    id: 1,
    title: "Matrix",
    overview: "Ein Hacker erfährt, dass die Welt eine Simulation ist, und schließt sich dem Widerstand an.",
    release_date: "1999-03-31",
    poster_path: null,
    backdrop_path: null,
    vote_average: 8.7
  },
  {
    id: 2,
    title: "Inception",
    overview: "Ein Dieb, der in die Träume anderer eindringen kann, erhält den Auftrag, eine Idee zu pflanzen.",
    release_date: "2010-07-16",
    poster_path: null,
    backdrop_path: null,
    vote_average: 8.2
  },
  {
    id: 3,
    title: "Interstellar",
    overview: "Ein Team von Astronauten reist durch ein Wurmloch, um eine neue Heimat für die Menschheit zu finden.",
    release_date: "2014-11-07",
    poster_path: null,
    backdrop_path: null,
    vote_average: 8.4
  }
];

// Serien-Daten (Fallback)
const tvData = [
  {
    id: 101,
    name: "Breaking Bad",
    overview: "Ein Chemielehrer wird zum Drogenproduzenten, um seiner Familie nach der Diagnose einer tödlichen Krankheit finanziell zu helfen.",
    first_air_date: "2008-01-20",
    poster_path: null,
    backdrop_path: null,
    vote_average: 9.2
  },
  {
    id: 102,
    name: "Game of Thrones",
    overview: "Mehrere noble Familien kämpfen um die Kontrolle über das mythische Land Westeros.",
    first_air_date: "2011-04-17",
    poster_path: null,
    backdrop_path: null,
    vote_average: 8.3
  },
  {
    id: 103,
    name: "The Mandalorian",
    overview: "Die Abenteuer eines einsamen Kopfgeldjägers im äußeren Rand der Galaxie, weit weg von der Autorität der Neuen Republik.",
    first_air_date: "2019-11-12",
    poster_path: null,
    backdrop_path: null,
    vote_average: 8.5
  }
];

// Einfache Route zum Testen
router.get('/test', (req, res) => {
  res.json({ message: 'API funktioniert!' });
});

// Trending-Filme oder Serien
router.get('/trending', authenticate, async (req, res) => {
  try {
    const { type = 'movie' } = req.query;
    console.log('Trending-Anfrage für Typ:', type);
    
    const data = await tmdbService.getTrending(type);
    res.json(data);
  } catch (error) {
    console.error('Fehler bei Trending:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Kommende Filme oder Serien
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const { type = 'movie' } = req.query;
    console.log('Upcoming-Anfrage für Typ:', type);
    
    const data = await tmdbService.getUpcoming(type);
    res.json(data);
  } catch (error) {
    console.error('Fehler bei Upcoming:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Suche nach Filmen oder Serien
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, type = 'movie' } = req.query;
    console.log('Suche nach:', q, 'Typ:', type);
    
    // Wenn Suchbegriff leer ist, gib leere Ergebnisse zurück
    if (!q || q.trim() === '') {
      return res.json({
        page: 1,
        results: [],
        total_pages: 0,
        total_results: 0
      });
    }
    
    const data = await tmdbService.searchContent(q, type);
    res.json(data);
  } catch (error) {
    console.error('Fehler bei Suche:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router; 