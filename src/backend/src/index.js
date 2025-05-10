const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());

// Express JSON-Parser vor dem Logging konfigurieren
app.use(express.json());

// Logging für alle eingehenden Requests
app.use((req, res, next) => {
  console.log('--- Neue Anfrage ---');
  console.log('Methode:', req.method);
  console.log('Pfad:', req.originalUrl);
  console.log('Headers:', req.headers);
  if (req.body) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});

// Generelle Fehlerbehandlung für Anfragen
app.use((err, req, res, next) => {
  console.error('Server-Fehler:', err.message);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Ungültiges JSON! Rohdaten:', req.body);
    return res.status(400).json({ error: 'Ungültiges JSON-Format' });
  }
  res.status(500).json({ error: 'Interner Serverfehler' });
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Wartefunktion für Datenbankverbindung
const waitForDatabase = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('Datenbankverbindung hergestellt');
      return true;
    } catch (err) {
      console.log(`Warte auf Datenbankverbindung... (Versuch ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Konnte keine Verbindung zur Datenbank herstellen');
};

// Datenbank-Initialisierung
const initDb = async () => {
  try {
    await waitForDatabase();
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS watchlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );

      CREATE TABLE IF NOT EXISTS movies (
        id SERIAL PRIMARY KEY,
        watchlist_id INTEGER REFERENCES watchlists(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        year INTEGER,
        poster_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tmdb_id VARCHAR(255),
        media_type VARCHAR(50),
        backdrop_path TEXT,
        overview TEXT,
        vote_average DECIMAL(3,1),
        genres JSONB
      );
    `);
    console.log('Datenbank initialisiert');
  } catch (err) {
    console.error('Fehler bei der Datenbankinitialisierung:', err);
    process.exit(1); // Beende den Prozess bei Fehler
  }
};

// Starte die Initialisierung
initDb();

// Registrierung
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validierung der Eingaben
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Alle Felder müssen ausgefüllt werden' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein' });
    }

    // Überprüfen, ob Benutzer oder E-Mail bereits existiert
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userCheck.rows.length > 0) {
      if (userCheck.rows[0].username === username) {
        return res.status(400).json({ error: 'Dieser Benutzername ist bereits vergeben' });
      }
      if (userCheck.rows[0].email === email) {
        return res.status(400).json({ error: 'Diese E-Mail-Adresse ist bereits registriert' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username, email, hashedPassword]
    );
    
    res.status(201).json({ message: 'Benutzer erfolgreich registriert' });
  } catch (err) {
    console.error('Registrierungsfehler:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen: ' + err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validierung der Eingaben
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültiges Passwort' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login-Fehler:', err);
    res.status(500).json({ error: 'Login fehlgeschlagen: ' + err.message });
  }
});

// Watchlist Endpunkt
app.post('/api/watchlist', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Prüfen ob Watchlist bereits existiert
    const existingWatchlist = await pool.query(
      'SELECT * FROM watchlists WHERE user_id = $1',
      [userId]
    );

    if (existingWatchlist.rows.length > 0) {
      return res.status(200).json({ 
        message: 'Watchlist bereits vorhanden',
        watchlistId: existingWatchlist.rows[0].id
      });
    }

    // Neue Watchlist erstellen
    const result = await pool.query(
      'INSERT INTO watchlists (user_id) VALUES ($1) RETURNING id',
      [userId]
    );

    res.status(201).json({ 
      message: 'Watchlist erfolgreich erstellt',
      watchlistId: result.rows[0].id
    });
  } catch (err) {
    console.error('Watchlist-Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Erstellen der Watchlist: ' + err.message });
  }
});

// Film hinzufügen
app.post('/api/watchlist/movies', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Watchlist des Users finden
    const watchlist = await pool.query(
      'SELECT id FROM watchlists WHERE user_id = $1',
      [userId]
    );

    if (watchlist.rows.length === 0) {
      return res.status(404).json({ error: 'Keine Watchlist gefunden' });
    }

    // Benötigte Felder auslesen und standardisieren
    const { 
      title, 
      year, 
      posterUrl, 
      poster_url,
      tmdb_id,
      tmdbId, 
      media_type, 
      mediaType,
      backdrop_path,
      backdropPath,
      overview,
      vote_average,
      voteAverage,
      genres 
    } = req.body;

    // Standardisierte Werte verwenden (kompatibel mit beiden Versionen)
    const movieData = {
      title,
      year,
      poster_url: posterUrl || poster_url,
      tmdb_id: tmdb_id || tmdbId,
      media_type: media_type || mediaType,
      backdrop_path: backdrop_path || backdropPath,
      overview,
      vote_average: vote_average || voteAverage,
      genres
    };

    const watchlistId = watchlist.rows[0].id;

    // Film hinzufügen mit allen verfügbaren Feldern
    const result = await pool.query(
      `INSERT INTO movies 
      (watchlist_id, title, year, poster_url, tmdb_id, media_type, backdrop_path, overview, vote_average, genres) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [
        watchlistId, 
        movieData.title, 
        movieData.year, 
        movieData.poster_url,
        movieData.tmdb_id,
        movieData.media_type,
        movieData.backdrop_path,
        movieData.overview,
        movieData.vote_average,
        movieData.genres
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Film-Hinzufügen-Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen des Films: ' + err.message });
  }
});

// Filme abrufen
app.get('/api/watchlist/movies', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Watchlist des Users finden
    const watchlist = await pool.query(
      'SELECT id FROM watchlists WHERE user_id = $1',
      [userId]
    );

    if (watchlist.rows.length === 0) {
      return res.status(404).json({ error: 'Keine Watchlist gefunden' });
    }

    const watchlistId = watchlist.rows[0].id;

    // Filme abrufen
    const movies = await pool.query(
      'SELECT * FROM movies WHERE watchlist_id = $1 ORDER BY created_at DESC',
      [watchlistId]
    );

    res.json(movies.rows);
  } catch (err) {
    console.error('Film-Abrufen-Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Filme: ' + err.message });
  }
});

// Film löschen
app.delete('/api/watchlist/movies/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const movieId = req.params.id;

    // Prüfen ob der Film zur Watchlist des Users gehört
    const result = await pool.query(
      `DELETE FROM movies 
       WHERE id = $1 
       AND watchlist_id IN (SELECT id FROM watchlists WHERE user_id = $2)
       RETURNING *`,
      [movieId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Film nicht gefunden oder nicht autorisiert' });
    }

    res.json({ message: 'Film erfolgreich gelöscht' });
  } catch (err) {
    console.error('Film-Löschen-Fehler:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des Films: ' + err.message });
  }
});

const searchRoutes = require('./routes/search');
app.use('/api/search', searchRoutes);

const mediaRoutes = require('./routes/media');
app.use('/api', mediaRoutes);

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
}); 