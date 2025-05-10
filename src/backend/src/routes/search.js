const express = require('express');
const router = express.Router();
const tmdbService = require('../services/tmdb');

router.get('/', async (req, res) => {
  try {
    const { q, type } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Suchbegriff fehlt' });
    }

    const results = await tmdbService.searchContent(q, type || 'movie');
    res.json(results);
  } catch (error) {
    console.error('Fehler bei der Suche:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router; 