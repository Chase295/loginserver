const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());

// Verbesserte Fehlerbehandlung für JSON-Parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Ungültiges JSON! Details:', err.message);
    return res.status(400).json({ error: 'Ungültiges JSON-Format' });
  }
  next(err);
});

// Express JSON-Parser
app.use(express.json());

// Logging für alle eingehenden Requests
app.use((req, res, next) => {
  console.log('--- Neue Anfrage ---');
  console.log('Methode:', req.method);
  console.log('Pfad:', req.originalUrl);
  console.log('Headers:', req.headers);
  if (req.body) {
    try {
      console.log('Body:', typeof req.body === 'object' ? JSON.stringify(req.body) : req.body);
    } catch (e) {
      console.log('Body (nicht als JSON darstellbar):', req.body);
    }
  }
  next();
});

// Middleware für Token-Authentifizierung
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token ungültig' });
    }
    req.user = user;
    next();
  });
};

// Generelle Fehlerbehandlung für Anfragen
app.use((err, req, res, next) => {
  console.error('Server-Fehler:', err.message);
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
        private_tags JSONB DEFAULT '[]',
        private_titles JSONB DEFAULT '[]',
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
        genres JSONB,
        status VARCHAR(20),
        abbruch_grund TEXT,
        rating INTEGER,
        notes TEXT,
        tags JSONB,
        is_private BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS friends (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        friendship_level VARCHAR(50),
        level_confirmed BOOLEAN DEFAULT FALSE,
        last_proposed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, receiver_id)
      );

      CREATE TABLE IF NOT EXISTS match_invitations (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, receiver_id)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        player1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        player2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'lobby',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS match_ready_status (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        is_ready BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(match_id, player_id)
      );
      
      CREATE TABLE IF NOT EXISTS match_pool (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(match_id, player_id, movie_id)
      );
      
      CREATE TABLE IF NOT EXISTS match_likes (
        id SERIAL PRIMARY KEY,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        player_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        liked BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(match_id, player_id, movie_id)
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

// Hilfsfunktion: Film zu allen aktiven Matches hinzufügen
const addMovieToActiveMatches = async (userId, movieId) => {
  try {
    console.log(`Prüfe, ob der Film ${movieId} zu aktiven Matches des Users ${userId} hinzugefügt werden kann...`);
    
    // Aktive Matches abrufen, an denen der User teilnimmt
    const activeMatches = await pool.query(
      `SELECT m.* 
       FROM matches m
       WHERE (m.player1_id = $1 OR m.player2_id = $1)
       AND m.status IN ('lobby', 'active')`,
      [userId]
    );
    
    if (activeMatches.rows.length === 0) {
      console.log(`Keine aktiven Matches für User ${userId} gefunden.`);
      return;
    }
    
    console.log(`${activeMatches.rows.length} aktive Matches für User ${userId} gefunden.`);
    
    // Prüfen, ob der Film zur Watchlist des Users gehört
    const movieCheck = await pool.query(
      `SELECT m.* FROM movies m
       JOIN watchlists w ON m.watchlist_id = w.id
       WHERE m.id = $1 AND w.user_id = $2`,
      [movieId, userId]
    );
    
    if (movieCheck.rows.length === 0) {
      console.log(`Film ${movieId} gehört nicht zur Watchlist von User ${userId}`);
      return;
    }
    
    console.log(`Film ${movieId} gehört zur Watchlist von User ${userId}, füge zu aktiven Matches hinzu`);
    
    // Film zu jedem aktiven Match hinzufügen
    for (const match of activeMatches.rows) {
      try {
        // Prüfen, ob der User als bereit markiert ist
        const readyStatus = await pool.query(
          'SELECT * FROM match_ready_status WHERE match_id = $1 AND player_id = $2 AND is_ready = TRUE',
          [match.id, userId]
        );
        
        if (readyStatus.rows.length === 0) {
          console.log(`User ${userId} ist nicht als bereit im Match ${match.id} markiert, überspringe.`);
          continue;
        }
        
        // Film zum Pool hinzufügen
        await pool.query(
          'INSERT INTO match_pool (match_id, player_id, movie_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [match.id, userId, movieId]
        );
        
        console.log(`Film ${movieId} erfolgreich zum Match-Pool für Match ${match.id} hinzugefügt`);
      } catch (err) {
        console.error(`Fehler beim Hinzufügen von Film ${movieId} zum Match ${match.id}:`, err);
      }
    }
  } catch (err) {
    console.error(`Fehler bei addMovieToActiveMatches für User ${userId}, Film ${movieId}:`, err);
  }
};

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
      genres,
      status,
      abbruch_grund,
      rating,
      notes,
      tags
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
      genres,
      status,
      abbruch_grund,
      rating,
      notes,
      tags
    };

    const watchlistId = watchlist.rows[0].id;

    // Film hinzufügen mit allen verfügbaren Feldern
    const result = await pool.query(
      `INSERT INTO movies 
      (watchlist_id, title, year, poster_url, tmdb_id, media_type, backdrop_path, overview, vote_average, genres, status, abbruch_grund, rating, notes, tags) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
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
        JSON.stringify(movieData.genres || []),
        movieData.status,
        movieData.abbruch_grund,
        movieData.rating,
        movieData.notes,
        JSON.stringify(movieData.tags || [])
      ]
    );

    // Film automatisch zu aktiven Matches hinzufügen
    addMovieToActiveMatches(userId, result.rows[0].id);

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

// Alle vom User verwendeten Tags aggregieren
app.get('/api/user/tags', async (req, res) => {
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

    // Alle Tags aus allen Filmen/Serien der Watchlist holen
    const result = await pool.query(
      'SELECT tags FROM movies WHERE watchlist_id = $1 AND tags IS NOT NULL',
      [watchlistId]
    );
    const allTags = [];
    result.rows.forEach(row => {
      try {
        const tags = Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => {
            if (tag && tag.label) {
              // Füge Tag nur hinzu, wenn er entweder öffentlich ist oder dem User gehört
              if (!tag.is_private || (tag.is_private && tag.user_id === userId)) {
                allTags.push({ 
                  label: tag.label, 
                  color: tag.color || '#2196f3',
                  is_private: tag.is_private || false,
                  user_id: tag.user_id || userId
                });
              }
            }
          });
        }
      } catch (e) {
        // Fehler beim Parsen ignorieren
      }
    });
    // Duplikate entfernen (label+color+is_private+user_id eindeutig)
    const uniqueTags = Array.from(
      new Map(allTags.map(tag => [
        `${tag.label}|${tag.color}|${tag.is_private}|${tag.user_id}`, 
        tag
      ])).values()
    );
    res.json(uniqueTags);
  } catch (err) {
    console.error('Fehler beim Aggregieren der User-Tags:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Tags: ' + err.message });
  }
});

// Watchlist-Eintrag nach tmdb_id und media_type für den User holen
app.get('/api/watchlist/movie/:tmdb_id/:media_type', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { tmdb_id, media_type } = req.params;

    // Watchlist des Users finden
    const watchlist = await pool.query(
      'SELECT id FROM watchlists WHERE user_id = $1',
      [userId]
    );
    if (watchlist.rows.length === 0) {
      return res.status(404).json({ error: 'Keine Watchlist gefunden' });
    }
    const watchlistId = watchlist.rows[0].id;

    // Eintrag suchen
    const result = await pool.query(
      'SELECT * FROM movies WHERE watchlist_id = $1 AND tmdb_id = $2 AND media_type = $3',
      [watchlistId, tmdb_id, media_type]
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fehler beim Suchen des Watchlist-Eintrags:', err);
    res.status(500).json({ error: 'Fehler beim Suchen des Eintrags: ' + err.message });
  }
});

// Watchlist-Eintrag aktualisieren
app.put('/api/watchlist/movies/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const movieId = req.params.id;
    const {
      title,
      year,
      poster_url,
      tmdb_id,
      media_type,
      backdrop_path,
      overview,
      vote_average,
      genres,
      status,
      abbruch_grund,
      rating,
      notes,
      tags,
      is_private
    } = req.body;

    // Prüfen, ob der Film zur Watchlist des Users gehört
    const check = await pool.query(
      'SELECT * FROM movies WHERE id = $1 AND watchlist_id IN (SELECT id FROM watchlists WHERE user_id = $2)',
      [movieId, userId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Film nicht gefunden oder nicht autorisiert' });
    }

    // Update durchführen
    const result = await pool.query(
      `UPDATE movies SET
        title = $1,
        year = $2,
        poster_url = $3,
        tmdb_id = $4,
        media_type = $5,
        backdrop_path = $6,
        overview = $7,
        vote_average = $8,
        genres = $9,
        status = $10,
        abbruch_grund = $11,
        rating = $12,
        notes = $13,
        tags = $14,
        is_private = $15
      WHERE id = $16
      RETURNING *`,
      [
        title,
        year,
        poster_url,
        tmdb_id,
        media_type,
        backdrop_path,
        overview,
        vote_average,
        JSON.stringify(genres || []),
        status,
        abbruch_grund,
        rating,
        notes,
        JSON.stringify(tags || []),
        is_private === true,
        movieId
      ]
    );

    // Film automatisch zu aktiven Matches hinzufügen (falls Status geändert wurde oder andere relevante Änderungen)
    addMovieToActiveMatches(userId, movieId);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Watchlist-Eintrags:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren: ' + err.message });
  }
});

const searchRoutes = require('./routes/search');
app.use('/api/search', searchRoutes);

const mediaRoutes = require('./routes/media');
app.use('/api', mediaRoutes);

// Hilfsfunktion: User-ID aus Token extrahieren
function getUserIdFromToken(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
}

// Freundschaftsanfrage senden
app.post('/api/friends/request', async (req, res) => {
  const userId = getUserIdFromToken(req);
  const { receiver_username } = req.body;
  if (!userId || !receiver_username) {
    return res.status(400).json({ error: 'Fehlende Daten oder nicht autorisiert' });
  }
  try {
    const receiver = await pool.query('SELECT id FROM users WHERE username = $1', [receiver_username]);
    if (receiver.rows.length === 0) {
      return res.status(404).json({ error: 'Empfänger nicht gefunden' });
    }
    const receiverId = receiver.rows[0].id;
    if (receiverId === userId) {
      return res.status(400).json({ error: 'Du kannst dir selbst keine Anfrage senden' });
    }
    
    // Prüfe, ob bereits eine Freundschaft existiert
    const existingFriendship = await pool.query(
      'SELECT * FROM friends WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)) AND status = $3',
      [userId, receiverId, 'accepted']
    );
    if (existingFriendship.rows.length > 0) {
      return res.status(400).json({ error: 'Ihr seid bereits befreundet' });
    }

    // Prüfe, ob schon eine Anfrage existiert
    const existing = await pool.query(
      'SELECT * FROM friends WHERE sender_id = $1 AND receiver_id = $2',
      [userId, receiverId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Anfrage existiert bereits' });
    }
    
    await pool.query(
      'INSERT INTO friends (sender_id, receiver_id, status) VALUES ($1, $2, $3)',
      [userId, receiverId, 'pending']
    );
    res.json({ message: 'Anfrage gesendet' });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Senden der Anfrage: ' + err.message });
  }
});

// Alle Anfragen für eingeloggten User abrufen
app.get('/api/friends/requests', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    const result = await pool.query(
      `SELECT f.*, u.username as sender_username FROM friends f
       JOIN users u ON f.sender_id = u.id
       WHERE f.receiver_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Anfragen: ' + err.message });
  }
});

// Anfrage annehmen/ablehnen
app.post('/api/friends/respond', async (req, res) => {
  const userId = getUserIdFromToken(req);
  const { request_id, accept } = req.body;
  if (!userId || !request_id || typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'Fehlende Daten oder nicht autorisiert' });
  }
  try {
    const request = await pool.query('SELECT * FROM friends WHERE id = $1 AND receiver_id = $2', [request_id, userId]);
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    }
    const newStatus = accept ? 'accepted' : 'declined';
    await pool.query('UPDATE friends SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, request_id]);
    res.json({ message: `Anfrage ${newStatus === 'accepted' ? 'angenommen' : 'abgelehnt'}` });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Anfrage: ' + err.message });
  }
});

// Freundschaftslevel ändern
app.post('/api/friends/level', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { friend_id, friendship_level } = req.body;
    // Prüfe, ob der User an der Freundschaft beteiligt ist
    const check = await pool.query('SELECT * FROM friends WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)', [friend_id, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Keine Berechtigung' });
    await pool.query('UPDATE friends SET friendship_level = $1, level_confirmed = false, last_proposed_by = $2, updated_at = NOW() WHERE id = $3', [friendship_level, userId, friend_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Ändern des Levels: ' + err.message });
  }
});

// Freundschaft löschen
app.post('/api/friends/delete', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { friend_id } = req.body;
    // Prüfe, ob der User an der Freundschaft beteiligt ist
    const check = await pool.query('SELECT * FROM friends WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)', [friend_id, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Keine Berechtigung' });
    await pool.query('DELETE FROM friends WHERE id = $1', [friend_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Löschen der Freundschaft: ' + err.message });
  }
});

// Userliste (alle User außer sich selbst)
app.get('/api/userlist', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const result = await pool.query('SELECT id, username FROM users WHERE id != $1', [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Userliste: ' + err.message });
  }
});

// Freundesliste für eingeloggten User
app.get('/api/friends/list', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    // Hole alle akzeptierten Freundschaften, egal ob als sender oder receiver
    const result = await pool.query(`
      SELECT f.id, 
        CASE WHEN f.sender_id = $1 THEN u2.username ELSE u1.username END AS friend_username,
        CASE WHEN f.sender_id = $1 THEN u2.id ELSE u1.id END AS friend_user_id,
        f.friendship_level, f.level_confirmed
      FROM friends f
      JOIN users u1 ON f.sender_id = u1.id
      JOIN users u2 ON f.receiver_id = u2.id
      WHERE (f.sender_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Freundesliste: ' + err.message });
  }
});

// Watchlist eines anderen Users abrufen
app.get('/api/watchlist/user/:username', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const requestingUserId = decoded.userId;
    const targetUsername = req.params.username;

    // Ziel-User finden
    const targetUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [targetUsername]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const targetUserId = targetUser.rows[0].id;

    // Watchlist des Ziel-Users finden und Sichtbarkeit prüfen
    const watchlistRes = await pool.query(
      'SELECT id, watchlist_visibility FROM watchlists WHERE user_id = $1',
      [targetUserId]
    );

    if (watchlistRes.rows.length === 0) {
      return res.status(404).json({ error: 'Keine Watchlist gefunden' });
    }

    const watchlistId = watchlistRes.rows[0].id;
    const watchlistVisibility = watchlistRes.rows[0].watchlist_visibility || 'friends';

    // Sichtbarkeit prüfen: Wenn privat und nicht der Besitzer, dann verweigern
    if (watchlistVisibility === 'private' && requestingUserId !== targetUserId) {
      return res.status(403).json({ error: 'Diese Watchlist ist privat.' });
    }

    // Prüfen ob der anfragende User mit dem Ziel-User befreundet ist (nur wenn nicht public)
    if (watchlistVisibility !== 'public' && requestingUserId !== targetUserId) {
      const friendship = await pool.query(
        `SELECT * FROM friends 
         WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
         AND status = 'accepted'`,
        [requestingUserId, targetUserId]
      );
      if (friendship.rows.length === 0) {
        return res.status(403).json({ error: 'Keine Berechtigung - Freundschaft erforderlich' });
      }
    }

    // Filme der Watchlist abrufen
    const movies = await pool.query(
      'SELECT * FROM movies WHERE watchlist_id = $1 ORDER BY created_at DESC',
      [watchlistId]
    );

    // Filtere alle Titel heraus, die is_private true haben oder einen Tag mit is_private true enthalten
    const filteredMovies = movies.rows.filter(movie => {
      if (movie.is_private) return false;
      const tags = Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []);
      return !tags.some(tag => tag.is_private === true);
    });

    res.json(filteredMovies);
  } catch (err) {
    console.error('Fehler beim Abrufen der fremden Watchlist:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Watchlist: ' + err.message });
  }
});

// Tags eines anderen Users abrufen
app.get('/api/user/:username/tags', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const requestingUserId = decoded.userId;
    const targetUsername = req.params.username;

    // Ziel-User finden
    const targetUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [targetUsername]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const targetUserId = targetUser.rows[0].id;

    // Prüfen ob der anfragende User mit dem Ziel-User befreundet ist
    const friendship = await pool.query(
      `SELECT * FROM friends 
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
       AND status = 'accepted'`,
      [requestingUserId, targetUserId]
    );

    if (friendship.rows.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung - Freundschaft erforderlich' });
    }

    // Watchlist des Ziel-Users finden
    const watchlist = await pool.query(
      'SELECT id FROM watchlists WHERE user_id = $1',
      [targetUserId]
    );

    if (watchlist.rows.length === 0) {
      return res.json([]);
    }

    const watchlistId = watchlist.rows[0].id;

    // Alle Tags aus allen nicht-privaten Filmen/Serien der Watchlist holen, aber nur nicht-private Tags
    const result = await pool.query(
      'SELECT id, title, tmdb_id, tags, is_private FROM movies WHERE watchlist_id = $1 AND tags IS NOT NULL',
      [watchlistId]
    );

    const allTags = [];
    result.rows.forEach(row => {
      if (row.is_private) return;
      try {
        const tags = Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => {
            if (tag && tag.label && tag.is_private !== true) {
              allTags.push({ 
                label: tag.label, 
                color: tag.color || '#2196f3'
              });
            }
          });
        }
      } catch (e) {
        // Fehler beim Parsen ignorieren
      }
    });

    // Duplikate entfernen (label+color eindeutig)
    const uniqueTags = Array.from(
      new Map(allTags.map(tag => [tag.label + '|' + tag.color, tag])).values()
    );

    res.json(uniqueTags);
  } catch (err) {
    console.error('Fehler beim Abrufen der User-Tags:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Tags: ' + err.message });
  }
});

// Watchlist-Settings (private_tags, private_titles) speichern
app.put('/api/watchlist/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { private_tags, private_titles, watchlist_visibility } = req.body;

    // Hole die Watchlist ID des Users
    const watchlistResult = await pool.query(
      'SELECT id FROM watchlists WHERE user_id = $1',
      [userId]
    );
    const watchlistId = watchlistResult.rows[0].id;

    // Speichere die Einstellungen in der Watchlist
    await pool.query(
      'UPDATE watchlists SET private_tags = $1, private_titles = $2, watchlist_visibility = $3 WHERE id = $4',
      [JSON.stringify(private_tags), JSON.stringify(private_titles), watchlist_visibility || 'friends', watchlistId]
    );

    // Aktualisiere die privaten Tags in allen Filmen
    const movies = await pool.query(
      'SELECT * FROM movies WHERE watchlist_id = $1',
      [watchlistId]
    );

    // Für jeden Film
    for (const movie of movies.rows) {
      let tags = Array.isArray(movie.tags) ? movie.tags : (movie.tags ? JSON.parse(movie.tags) : []);
      
      // Aktualisiere die Tags
      tags = tags.map(tag => ({
        ...tag,
        is_private: private_tags.some(pt => pt.label === tag.label)
      }));

      // Ein Film ist privat wenn er in private_titles ist
      const isPrivate = private_titles.some(pt => pt.id === movie.id);

      // Aktualisiere den Film
      await pool.query(
        'UPDATE movies SET tags = $1, is_private = $2 WHERE id = $3',
        [JSON.stringify(tags), isPrivate, movie.id]
      );
    }

    res.json({ message: 'Einstellungen erfolgreich gespeichert' });
  } catch (err) {
    console.error('Fehler beim Speichern der Watchlist-Einstellungen:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Einstellungen: ' + err.message });
  }
});

// Watchlist-Settings abrufen
app.get('/api/watchlist/settings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Watchlist finden
    const watchlist = await pool.query(
      'SELECT private_tags, private_titles, watchlist_visibility FROM watchlists WHERE user_id = $1',
      [userId]
    );

    if (watchlist.rows.length === 0) {
      return res.status(404).json({ error: 'Keine Watchlist gefunden' });
    }

    const settings = watchlist.rows[0];
    res.json({
      private_tags: settings.private_tags || [],
      private_titles: settings.private_titles || [],
      watchlist_visibility: settings.watchlist_visibility || 'friends'
    });
  } catch (err) {
    console.error('Fehler beim Abrufen der Watchlist-Settings:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Einstellungen: ' + err.message });
  }
});

// Sichtbarkeit der Watchlist eines beliebigen Users abfragen
app.get('/api/watchlist/visibility/:username', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const requestingUserId = decoded.userId;
    const targetUsername = req.params.username;

    // Ziel-User finden
    const targetUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [targetUsername]
    );
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    const targetUserId = targetUser.rows[0].id;

    // Watchlist finden
    const watchlist = await pool.query(
      'SELECT watchlist_visibility FROM watchlists WHERE user_id = $1',
      [targetUserId]
    );
    if (watchlist.rows.length === 0) {
      return res.status(404).json({ error: 'Keine Watchlist gefunden' });
    }
    res.json({ watchlist_visibility: watchlist.rows[0].watchlist_visibility || 'friends' });
  } catch (err) {
    console.error('Fehler beim Abfragen der Watchlist-Visibility:', err);
    res.status(500).json({ error: 'Fehler beim Abfragen der Sichtbarkeit: ' + err.message });
  }
});

// Match-Einladungen und -Verwaltung

// Match-Einladung senden
app.post('/api/match/invite', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const senderId = decoded.userId;
    const { receiver_id } = req.body;

    // Debug-Logging
    console.log(`Neue Match-Einladung: Sender ${senderId} -> Empfänger ${receiver_id}`);

    if (!receiver_id) {
      return res.status(400).json({ error: 'Empfänger-ID fehlt' });
    }

    if (senderId === parseInt(receiver_id)) {
      return res.status(400).json({ error: 'Du kannst dich nicht selbst herausfordern' });
    }

    // Prüfen, ob der Empfänger existiert
    const receiverExists = await pool.query('SELECT id, username FROM users WHERE id = $1', [receiver_id]);
    if (receiverExists.rows.length === 0) {
      return res.status(404).json({ error: 'Empfänger nicht gefunden' });
    }
    
    const receiverUsername = receiverExists.rows[0].username;
    
    // Eigenen Benutzernamen finden
    const sender = await pool.query('SELECT username FROM users WHERE id = $1', [senderId]);
    const senderUsername = sender.rows[0].username;
    
    console.log(`Match-Einladung: ${senderUsername} (ID:${senderId}) -> ${receiverUsername} (ID:${receiver_id})`);

    // Prüfen, ob sie befreundet sind
    const areFriends = await pool.query(
      `SELECT * FROM friends 
       WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
       AND status = 'accepted'`,
      [senderId, receiver_id]
    );
    if (areFriends.rows.length === 0) {
      return res.status(403).json({ error: 'Ihr müsst befreundet sein, um ein Match zu starten' });
    }

    // Prüfen, ob bereits eine ausstehende Einladung existiert (in beide Richtungen)
    const existingInvitation = await pool.query(
      'SELECT * FROM match_invitations WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)) AND status = $3',
      [senderId, receiver_id, 'pending']
    );
    if (existingInvitation.rows.length > 0) {
      const invDirection = existingInvitation.rows[0].sender_id === parseInt(senderId) ? 'ausgehend' : 'eingehend';
      console.log(`Bestehende ${invDirection}e Einladung gefunden zwischen ${senderUsername} und ${receiverUsername}`);
      
      // Wenn es eine eingehende Einladung ist, akzeptieren wir sie automatisch statt einen Fehler zu werfen
      if (invDirection === 'eingehend') {
        // Einladung akzeptieren
        await pool.query(
          'UPDATE match_invitations SET status = $1, updated_at = NOW() WHERE id = $2',
          ['accepted', existingInvitation.rows[0].id]
        );
        
        // Prüfen, ob bereits ein Match existiert
        const existingMatch = await pool.query(
          `SELECT * FROM matches 
           WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
           AND status IN ('lobby', 'active')`,
          [senderId, receiver_id]
        );
        
        if (existingMatch.rows.length > 0) {
          console.log(`Bestehendes Match #${existingMatch.rows[0].id} gefunden beim automatischen Akzeptieren einer Einladung`);
          return res.status(200).json({ 
            message: 'Gegenseitige Einladung automatisch akzeptiert, bestehendes Match verwendet',
            match_id: existingMatch.rows[0].id
          });
        }
        
        // Neues Match erstellen
        try {
          const matchResult = await pool.query(
            'INSERT INTO matches (player1_id, player2_id, status) VALUES ($1, $2, $3) RETURNING id',
            [existingInvitation.rows[0].sender_id, senderId, 'lobby']
          );
          
          return res.status(200).json({ 
            message: 'Gegenseitige Einladung automatisch akzeptiert',
            match_id: matchResult.rows[0].id
          });
        } catch (err) {
          // Falls das INSERT fehlschlägt, versuchen wir nochmal nach einem existierenden Match zu suchen
          // (möglicherweise Race Condition mit einem anderen Request)
          const retryMatch = await pool.query(
            `SELECT * FROM matches 
             WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
             AND status IN ('lobby', 'active')`,
            [senderId, receiver_id]
          );
          
          if (retryMatch.rows.length > 0) {
            console.log(`Match #${retryMatch.rows[0].id} bei zweitem Versuch gefunden`);
            return res.status(200).json({ 
              message: 'Gegenseitige Einladung automatisch akzeptiert, Match gefunden',
              match_id: retryMatch.rows[0].id
            });
          }
          
          // Wenn immer noch kein Match gefunden wurde, den Fehler weiterwerfen
          throw err;
        }
      }
      
      return res.status(400).json({ error: `Es gibt bereits eine ${invDirection}e ausstehende Einladung` });
    }

    // Prüfen, ob ein aktives Match existiert (in beide Richtungen)
    const existingMatch = await pool.query(
      `SELECT * FROM matches 
       WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
       AND status IN ('lobby', 'active')`,
      [senderId, receiver_id]
    );
    if (existingMatch.rows.length > 0) {
      console.log(`Verhindere doppeltes Match zwischen ${senderUsername} und ${receiverUsername}. Bestehendes Match:`, existingMatch.rows[0]);
      return res.status(400).json({ error: 'Es gibt bereits ein aktives Match zwischen euch' });
    }

    // ZUSÄTZLICHE SICHERHEITSPRÜFUNG: Prüfe anhand der Benutzernamen
    // Diese Prüfung ist redundant, aber erhöht die Sicherheit
    const matchesWithUsernames = await pool.query(`
      SELECT m.*, 
        u1.username as player1_username,
        u2.username as player2_username
      FROM matches m
      JOIN users u1 ON m.player1_id = u1.id
      JOIN users u2 ON m.player2_id = u2.id
      WHERE 
        ((u1.username = $1 AND u2.username = $2) OR (u1.username = $2 AND u2.username = $1))
        AND m.status IN ('lobby', 'active')
    `, [senderUsername, receiverUsername]);
    
    if (matchesWithUsernames.rows.length > 0) {
      console.log(`DUPLIKAT-MATCH VERHINDERT durch Benutzernamenprüfung zwischen ${senderUsername} und ${receiverUsername}`);
      return res.status(400).json({ error: 'Es gibt bereits ein aktives Match zwischen euch (doppelte Prüfung)' });
    }

    // Neue Einladung erstellen
    const result = await pool.query(
      'INSERT INTO match_invitations (sender_id, receiver_id, status) VALUES ($1, $2, $3) RETURNING id',
      [senderId, receiver_id, 'pending']
    );

    console.log(`Neue Match-Einladung erstellt: ID ${result.rows[0].id} - ${senderUsername} -> ${receiverUsername}`);

    res.status(201).json({ 
      message: 'Match-Einladung gesendet',
      invitation_id: result.rows[0].id
    });
  } catch (err) {
    console.error('Fehler beim Senden der Match-Einladung:', err);
    
    // Spezielle Behandlung des Unique-Constraint-Fehlers
    if (err.code === '23505' && err.constraint === 'match_invitations_sender_id_receiver_id_key') {
      try {
        // Alte Einladung mit anderem Status (nicht 'pending') finden und löschen
        const { receiver_id } = req.body;
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const senderId = decoded.userId;
        
        console.log(`Versuche alte Einladung zwischen ${senderId} und ${receiver_id} zu löschen`);
        
        // Einladung mit beliebigem Status löschen
        const deletedInvs = await pool.query(
          'DELETE FROM match_invitations WHERE sender_id = $1 AND receiver_id = $2 RETURNING id, status',
          [senderId, receiver_id]
        );
        
        console.log(`${deletedInvs.rows.length} alte Einladungen gelöscht:`, deletedInvs.rows);
        
        // Erneut versuchen, die Einladung zu erstellen
        const newResult = await pool.query(
          'INSERT INTO match_invitations (sender_id, receiver_id, status) VALUES ($1, $2, $3) RETURNING id',
          [senderId, receiver_id, 'pending']
        );
        
        return res.status(201).json({ 
          message: 'Match-Einladung gesendet (nach Löschung alter Einladung)',
          invitation_id: newResult.rows[0].id
        });
      } catch (retryErr) {
        console.error('Fehler beim erneuten Versuch der Einladung:', retryErr);
        return res.status(500).json({ error: 'Fehler beim Senden der Einladung auch nach Löschversuch: ' + retryErr.message });
      }
    }
    
    res.status(500).json({ error: 'Fehler beim Senden der Einladung: ' + err.message });
  }
});

// Match-Einladung zurückziehen
app.post('/api/match/invite/cancel', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { invitation_id } = req.body;

    if (!invitation_id) {
      return res.status(400).json({ error: 'Einladungs-ID fehlt' });
    }

    // Prüfen, ob der User der Absender ist
    const invitation = await pool.query(
      'SELECT * FROM match_invitations WHERE id = $1 AND sender_id = $2 AND status = $3',
      [invitation_id, userId, 'pending']
    );
    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Einladung nicht gefunden oder bereits beantwortet' });
    }

    // Einladung löschen
    await pool.query('DELETE FROM match_invitations WHERE id = $1', [invitation_id]);

    res.json({ message: 'Einladung zurückgezogen' });
  } catch (err) {
    console.error('Fehler beim Zurückziehen der Match-Einladung:', err);
    res.status(500).json({ error: 'Fehler beim Zurückziehen der Einladung: ' + err.message });
  }
});

// Match-Einladung annehmen oder ablehnen
app.post('/api/match/invite/respond', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const { invitation_id, accept } = req.body;

    if (!invitation_id || typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'Einladungs-ID oder Antwort fehlt' });
    }

    // Prüfen, ob der User der Empfänger ist
    const invitation = await pool.query(
      'SELECT * FROM match_invitations WHERE id = $1 AND receiver_id = $2 AND status = $3',
      [invitation_id, userId, 'pending']
    );
    if (invitation.rows.length === 0) {
      return res.status(404).json({ error: 'Einladung nicht gefunden oder bereits beantwortet' });
    }

    if (!accept) {
      // Einladung ablehnen
      await pool.query(
        'UPDATE match_invitations SET status = $1, updated_at = NOW() WHERE id = $2',
        ['declined', invitation_id]
      );
      return res.json({ message: 'Einladung abgelehnt' });
    }

    // Einladung annehmen
    await pool.query(
      'UPDATE match_invitations SET status = $1, updated_at = NOW() WHERE id = $2',
      ['accepted', invitation_id]
    );

    // Match erstellen
    const senderId = invitation.rows[0].sender_id;
    
    // Prüfen, ob bereits ein aktives Match zwischen den Spielern existiert
    const existingMatch = await pool.query(
      `SELECT * FROM matches 
       WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
       AND status IN ('lobby', 'active')`,
      [senderId, userId]
    );
    
    if (existingMatch.rows.length > 0) {
      // Es existiert bereits ein Match, dieses wiederverwenden
      console.log(`Wiederverwendung eines existierenden Matches zwischen ${senderId} und ${userId}. Match-ID: ${existingMatch.rows[0].id}`);
      
      // Stelle sicher, dass das Match im 'lobby' Status ist
      if (existingMatch.rows[0].status === 'active') {
        return res.json({ 
          message: 'Es läuft bereits ein aktives Match',
          match_id: existingMatch.rows[0].id
        });
      }
      
      // Setze Match auf 'lobby', falls es nicht bereits so ist
      if (existingMatch.rows[0].status !== 'lobby') {
        await pool.query(
          'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
          ['lobby', existingMatch.rows[0].id]
        );
      }
      
      return res.json({ 
        message: 'Einladung angenommen, bestehendes Match wiederverwendet',
        match_id: existingMatch.rows[0].id
      });
    }
    
    // Kein bestehendes Match gefunden, neues erstellen
    try {
      const matchResult = await pool.query(
        'INSERT INTO matches (player1_id, player2_id, status) VALUES ($1, $2, $3) RETURNING id',
        [senderId, userId, 'lobby']
      );

      res.json({ 
        message: 'Einladung angenommen',
        match_id: matchResult.rows[0].id
      });
    } catch (matchErr) {
      console.error('Fehler beim Erstellen des Matches:', matchErr);
      
      // Spezielle Behandlung des Unique-Constraint-Fehlers
      if (matchErr.code === '23505' && matchErr.constraint?.includes('matches_player')) {
        try {
          console.log(`Versuche alle beendeten Matches zwischen ${senderId} und ${userId} zu finden`);
          
          // Versuche, alte beendete/abgebrochene Matches zu finden
          const oldMatches = await pool.query(
            `SELECT * FROM matches 
             WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
             AND status IN ('finished', 'cancelled')
             ORDER BY updated_at DESC`,
            [senderId, userId]
          );
          
          if (oldMatches.rows.length > 0) {
            // Altes Match auf "lobby" setzen
            const oldMatchId = oldMatches.rows[0].id;
            console.log(`Verwende vorheriges Match (ID: ${oldMatchId}) und setze es auf 'lobby' zurück`);
            
            await pool.query(
              'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
              ['lobby', oldMatchId]
            );
            
            return res.json({ 
              message: 'Einladung angenommen (altes Match wiederverwendet)',
              match_id: oldMatchId
            });
          } else {
            // Falls kein beendetes Match gefunden wurde, noch einmal nach allen Matches suchen
            const anyMatch = await pool.query(
              `SELECT * FROM matches 
               WHERE (player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1)
               ORDER BY updated_at DESC LIMIT 1`,
              [senderId, userId]
            );
            
            if (anyMatch.rows.length > 0) {
              const matchId = anyMatch.rows[0].id;
              console.log(`Alternative Wiederherstellung: Match ID ${matchId} mit Status ${anyMatch.rows[0].status} gefunden`);
              
              // Match unabhängig vom Status zurücksetzen
              await pool.query(
                'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
                ['lobby', matchId]
              );
              
              return res.json({ 
                message: 'Einladung angenommen (bestehendes Match zurückgesetzt)',
                match_id: matchId
              });
            }
            
            // Wenn wir hier landen, gibt es irgendein Problem, das wir nicht lösen können
            throw new Error('Kein vorhandenes Match gefunden trotz Unique-Constraint-Fehler');
          }
        } catch (retryErr) {
          console.error('Fehler beim Wiederherstellen eines alten Matches:', retryErr);
          return res.status(500).json({ error: 'Fehler beim Annehmen der Einladung: ' + retryErr.message });
        }
      }
      
      // Wenn es ein anderer Fehler ist, diesen weiterleiten
      return res.status(500).json({ error: 'Fehler beim Erstellen des Matches: ' + matchErr.message });
    }
  } catch (err) {
    console.error('Fehler beim Beantworten der Match-Einladung:', err);
    res.status(500).json({ error: 'Fehler beim Beantworten der Einladung: ' + err.message });
  }
});

// Empfangene Match-Einladungen abrufen
app.get('/api/match/invites/received', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const invitations = await pool.query(
      `SELECT mi.*, u.username as sender_username
       FROM match_invitations mi
       JOIN users u ON mi.sender_id = u.id
       WHERE mi.receiver_id = $1 AND mi.status = 'pending'
       ORDER BY mi.created_at DESC`,
      [userId]
    );

    res.json(invitations.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen der Match-Einladungen:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Einladungen: ' + err.message });
  }
});

// Gesendete Match-Einladungen abrufen
app.get('/api/match/invites/sent', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const invitations = await pool.query(
      `SELECT mi.*, u.username as receiver_username
       FROM match_invitations mi
       JOIN users u ON mi.receiver_id = u.id
       WHERE mi.sender_id = $1 AND mi.status = 'pending'
       ORDER BY mi.created_at DESC`,
      [userId]
    );

    res.json(invitations.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen der gesendeten Match-Einladungen:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Einladungen: ' + err.message });
  }
});

// Aktive Matches abrufen
app.get('/api/match/active', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Debug-Logging
    console.log(`Aktive Matches für User ${userId} werden abgerufen`);

    const matches = await pool.query(
      `SELECT m.*, 
        p1.username as player1_username, 
        p2.username as player2_username
      FROM matches m
      JOIN users p1 ON m.player1_id = p1.id
      JOIN users p2 ON m.player2_id = p2.id
      WHERE (m.player1_id = $1 OR m.player2_id = $1)
      AND m.status IN ('lobby', 'active')
      ORDER BY m.updated_at DESC`,
      [userId]
    );

    // Debug-Logging
    console.log(`${matches.rows.length} aktive Matches gefunden für User ${userId}`);
    if (matches.rows.length > 0) {
      console.log('Match-Details:', JSON.stringify(matches.rows));
    }

    res.json(matches.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen aktiver Matches:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Spezifisches Match abrufen
app.get('/api/match/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;

    const match = await pool.query(
      `SELECT m.*, 
        u1.username as player1_username,
        u2.username as player2_username
      FROM matches m
      JOIN users u1 ON m.player1_id = u1.id
      JOIN users u2 ON m.player2_id = u2.id
      WHERE m.id = $1 AND (m.player1_id = $2 OR m.player2_id = $2)`,
      [matchId, userId]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }

    res.json(match.rows[0]);
  } catch (err) {
    console.error('Fehler beim Abrufen des Matches:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen des Matches: ' + err.message });
  }
});

// Match-Status aktualisieren (z.B. von lobby zu active)
app.put('/api/match/:id/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;
    const { status } = req.body;

    if (!status || !['lobby', 'active', 'finished', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }

    // Prüfen, ob der User am Match teilnimmt
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [matchId, userId]
    );
    if (match.rows.length === 0) {
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }

    // Status aktualisieren
    await pool.query(
      'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, matchId]
    );

    res.json({ message: 'Match-Status aktualisiert' });
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Match-Status:', err);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status: ' + err.message });
  }
});

// Freundesliste für Match-Einladungen
app.get('/api/match/friends', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Alle Freunde des Users abrufen
    const friends = await pool.query(`
      SELECT 
        CASE WHEN f.sender_id = $1 THEN f.receiver_id ELSE f.sender_id END AS friend_id,
        CASE WHEN f.sender_id = $1 THEN u2.username ELSE u1.username END AS friend_username
      FROM friends f
      JOIN users u1 ON f.sender_id = u1.id
      JOIN users u2 ON f.receiver_id = u2.id
      WHERE (f.sender_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'
    `, [userId]);

    res.json(friends.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen der Freundesliste für Matches:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Freundesliste: ' + err.message });
  }
});

// Match löschen
app.delete('/api/match/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;

    // Prüfen, ob der User Teilnehmer am Match ist
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [matchId, userId]
    );
    if (match.rows.length === 0) {
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }

    // Usernames für bessere Logs abrufen
    const player1Id = match.rows[0].player1_id;
    const player2Id = match.rows[0].player2_id;
    
    // Einzelne Abfragen für jeden Spieler anstelle von IN-Klausel
    const player1 = await pool.query('SELECT username FROM users WHERE id = $1', [player1Id]);
    const player2 = await pool.query('SELECT username FROM users WHERE id = $1', [player2Id]);
    
    const player1Username = player1.rows[0]?.username || 'Unbekannt';
    const player2Username = player2.rows[0]?.username || 'Unbekannt';
    
    console.log(`Lösche Match #${matchId} zwischen ${player1Username} und ${player2Username}`);

    // Zugehörige Einladungen löschen (alle Richtungen und Status)
    const deletedInvitations = await pool.query(
      'DELETE FROM match_invitations WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) RETURNING id, status',
      [player1Id, player2Id]
    );
    
    console.log(`${deletedInvitations.rows.length} Einladungen zwischen Spielern gelöscht:`, deletedInvitations.rows);

    // Match löschen (kaskadiert durch ON DELETE CASCADE auf match_ready_status)
    await pool.query('DELETE FROM matches WHERE id = $1', [matchId]);

    res.json({ 
      message: 'Match erfolgreich gelöscht',
      deletedInvitations: deletedInvitations.rows.length 
    });
  } catch (err) {
    console.error('Fehler beim Löschen des Matches:', err);
    res.status(500).json({ error: 'Fehler beim Löschen des Matches: ' + err.message });
  }
});

// Spieler als bereit markieren
app.post('/api/match/:id/ready', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;

    console.log(`POST /api/match/${matchId}/ready - User ${userId} markiert sich als bereit`);

    // Prüfen, ob der User am Match teilnimmt
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [matchId, userId]
    );
    
    if (match.rows.length === 0) {
      console.log(`User ${userId} nimmt nicht am Match ${matchId} teil`);
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }
    
    const matchData = match.rows[0];
    console.log(`Match gefunden für User ${userId}:`, matchData);
    
    // Prüfen, ob es bereits Filme im Pool von diesem Spieler gibt
    const existingPoolMovies = await pool.query(
      'SELECT COUNT(*) FROM match_pool WHERE match_id = $1 AND player_id = $2',
      [matchId, userId]
    );
    
    const poolMoviesCount = parseInt(existingPoolMovies.rows[0].count);
    console.log(`${poolMoviesCount} Filme bereits im Pool von User ${userId} für Match ${matchId}`);
    
    // Wenn noch keine Filme im Pool sind, automatisch einige hinzufügen
    if (poolMoviesCount === 0) {
      console.log(`Keine Filme im Pool für User ${userId}, füge automatisch Filme hinzu...`);
      
      // Watchlist des Users finden
      const watchlist = await pool.query(
        'SELECT id FROM watchlists WHERE user_id = $1',
        [userId]
      );
      
      if (watchlist.rows.length === 0) {
        console.log(`Keine Watchlist für User ${userId} gefunden`);
        return res.status(404).json({ error: 'Keine Watchlist gefunden' });
      }
      
      const watchlistId = watchlist.rows[0].id;
      console.log(`Watchlist ${watchlistId} für User ${userId} gefunden`);
      
      // Bis zu 10 zufällige Filme aus der Watchlist des Users holen
      const movies = await pool.query(
        'SELECT id FROM movies WHERE watchlist_id = $1 ORDER BY RANDOM() LIMIT 10',
        [watchlistId]
      );
      
      console.log(`${movies.rows.length} Filme aus der Watchlist von User ${userId} geladen`);
      
      // Filme zum Pool hinzufügen
      let addedCount = 0;
      for (const movie of movies.rows) {
        try {
          await pool.query(
            'INSERT INTO match_pool (match_id, player_id, movie_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [matchId, userId, movie.id]
          );
          addedCount++;
          console.log(`Film ${movie.id} erfolgreich zum Match-Pool hinzugefügt`);
        } catch (err) {
          console.error(`Fehler beim Hinzufügen von Film ${movie.id}:`, err);
        }
      }
      
      console.log(`${addedCount} Filme automatisch zum Match-Pool für User ${userId} hinzugefügt`);
    }
    
    // Bereit-Status für diesen Spieler setzen oder aktualisieren
    await pool.query(
      `INSERT INTO match_ready_status (match_id, player_id, is_ready) 
       VALUES ($1, $2, TRUE) 
       ON CONFLICT (match_id, player_id) 
       DO UPDATE SET is_ready = TRUE, updated_at = NOW()`,
      [matchId, userId]
    );
    
    // Prüfen, ob beide Spieler bereit sind
    const readyCount = await pool.query(
      'SELECT COUNT(*) FROM match_ready_status WHERE match_id = $1 AND is_ready = TRUE',
      [matchId]
    );
    
    const totalPlayers = 2; // Ein Match hat immer 2 Spieler
    const readyPlayersCount = parseInt(readyCount.rows[0].count);
    const bothReady = readyPlayersCount >= totalPlayers;
    
    console.log(`Match ${matchId}: ${readyPlayersCount}/${totalPlayers} Spieler bereit.`);
    
    // Wenn beide Spieler bereit sind, Match aktivieren
    if (bothReady) {
      await pool.query(
        'UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2',
        ['active', matchId]
      );
      console.log(`Match ${matchId} aktiviert - beide Spieler sind bereit!`);
    }
    
    res.json({ 
      message: 'Bereit-Status gesetzt', 
      player_ready: true,
      match_active: bothReady
    });
  } catch (err) {
    console.error('Fehler beim Setzen des Bereit-Status:', err);
    res.status(500).json({ error: 'Fehler beim Setzen des Bereit-Status: ' + err.message });
  }
});

// Match-Status abfragen (einschließlich Ready-Status beider Spieler)
app.get('/api/match/:id/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;

    // Prüfen, ob der User am Match teilnimmt
    const match = await pool.query(
      `SELECT m.*, 
        u1.username as player1_username,
        u2.username as player2_username
      FROM matches m
      JOIN users u1 ON m.player1_id = u1.id
      JOIN users u2 ON m.player2_id = u2.id
      WHERE m.id = $1 AND (m.player1_id = $2 OR m.player2_id = $2)`,
      [matchId, userId]
    );
    
    if (match.rows.length === 0) {
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }

    const matchData = match.rows[0];
    
    // Ready-Status aller Spieler abrufen
    const readyStatus = await pool.query(
      `SELECT mrs.player_id, mrs.is_ready, u.username
       FROM match_ready_status mrs
       JOIN users u ON mrs.player_id = u.id
       WHERE mrs.match_id = $1`,
      [matchId]
    );
    
    // Anzahl bereiter Spieler
    const readyCount = await pool.query(
      'SELECT COUNT(*) FROM match_ready_status WHERE match_id = $1 AND is_ready = TRUE',
      [matchId]
    );
    
    const totalPlayers = 2;
    const readyPlayersCount = parseInt(readyCount.rows[0].count);
    const allReady = readyPlayersCount >= totalPlayers;
    
    // Prüfe, ob der anfragende Spieler bereit ist
    const userReady = readyStatus.rows.some(
      rs => rs.player_id === userId && rs.is_ready === true
    );
    
    res.json({
      match: matchData,
      readyStatus: readyStatus.rows,
      userReady: userReady,
      allReady: allReady,
      readyCount: readyPlayersCount
    });
  } catch (err) {
    console.error('Fehler beim Abrufen des Match-Status:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen des Match-Status: ' + err.message });
  }
});

// Filme vom Spieler zum Match-Pool hinzufügen
app.post('/api/match/:id/pool', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;
    const { movie_ids } = req.body;

    console.log(`POST /api/match/${matchId}/pool - User ${userId} fügt Filme hinzu:`, movie_ids);

    if (!movie_ids || !Array.isArray(movie_ids) || movie_ids.length === 0) {
      console.log('Keine Filme ausgewählt oder ungültiges Format:', movie_ids);
      return res.status(400).json({ error: 'Keine Filme ausgewählt' });
    }

    // Prüfen, ob der User am Match teilnimmt
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [matchId, userId]
    );
    
    if (match.rows.length === 0) {
      console.log(`User ${userId} nimmt nicht am Match ${matchId} teil`);
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }
    
    console.log(`Match gefunden für User ${userId}:`, match.rows[0]);
    
    // Prüfen, ob die Filme zur Watchlist des Users gehören
    const watchlist = await pool.query(
      'SELECT id FROM watchlists WHERE user_id = $1',
      [userId]
    );
    
    if (watchlist.rows.length === 0) {
      console.log(`Keine Watchlist für User ${userId} gefunden`);
      return res.status(404).json({ error: 'Keine Watchlist gefunden' });
    }
    
    const watchlistId = watchlist.rows[0].id;
    console.log(`Watchlist ${watchlistId} für User ${userId} gefunden`);
    
    // Füge jeden Film zum Pool hinzu
    const addedMovies = [];
    for (const movieId of movie_ids) {
      try {
        // Prüfe, ob der Film zur Watchlist des Users gehört
        const movieCheck = await pool.query(
          'SELECT * FROM movies WHERE id = $1 AND watchlist_id = $2',
          [movieId, watchlistId]
        );
        
        if (movieCheck.rows.length === 0) {
          console.log(`Film ${movieId} gehört nicht zur Watchlist ${watchlistId} des Users ${userId}`);
          continue; // Überspringe diesen Film
        }
        
        console.log(`Film ${movieId} gehört zur Watchlist des Users ${userId}, füge zum Match-Pool hinzu`);
        
        // Film zum Pool hinzufügen
        await pool.query(
          'INSERT INTO match_pool (match_id, player_id, movie_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [matchId, userId, movieId]
        );
        
        addedMovies.push(movieId);
        console.log(`Film ${movieId} erfolgreich zum Match-Pool hinzugefügt`);
      } catch (err) {
        console.error(`Fehler beim Hinzufügen von Film ${movieId}:`, err);
        // Wir ignorieren Fehler bei einzelnen Filmen und machen mit den anderen weiter
      }
    }
    
    console.log(`${addedMovies.length} Filme zum Match-Pool für Match ${matchId} hinzugefügt:`, addedMovies);
    
    res.json({ 
      message: `${addedMovies.length} Filme zum Match-Pool hinzugefügt`,
      added_movies: addedMovies
    });
  } catch (err) {
    console.error('Fehler beim Hinzufügen von Filmen zum Pool:', err);
    res.status(500).json({ error: 'Fehler beim Hinzufügen von Filmen: ' + err.message });
  }
});

// Filme aus dem Match-Pool abrufen, die der Spieler noch nicht bewertet hat
app.get('/api/match/:id/pool', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;

    console.log(`GET /api/match/${matchId}/pool - User ${userId} lädt Filme aus dem Pool`);

    // Prüfen, ob der User am Match teilnimmt
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [matchId, userId]
    );
    
    if (match.rows.length === 0) {
      console.log(`User ${userId} nimmt nicht am Match ${matchId} teil`);
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }
    
    // ÄNDERUNG: Alle Filme aus dem Pool abrufen, die der aktuelle Spieler noch nicht bewertet hat
    // (nicht nur die des anderen Spielers)
    const poolMovies = await pool.query(
      `SELECT mp.id as pool_id, mp.player_id as added_by_player_id, m.*, u.username as added_by_username
       FROM match_pool mp
       JOIN movies m ON mp.movie_id = m.id
       JOIN users u ON mp.player_id = u.id
       WHERE mp.match_id = $1 
       AND NOT EXISTS (
         SELECT 1 FROM match_likes ml 
         WHERE ml.match_id = mp.match_id 
         AND ml.player_id = $2 
         AND ml.movie_id = mp.movie_id
       )
       ORDER BY RANDOM()
       LIMIT 10`,
      [matchId, userId]
    );
    
    console.log(`${poolMovies.rows.length} Filme aus dem Match-Pool für Match ${matchId} geladen`);
    
    res.json(poolMovies.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen von Filmen aus dem Pool:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der Filme: ' + err.message });
  }
});

// Film liken oder disliken
app.post('/api/match/:id/like', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;
    const { movie_id, liked } = req.body;

    if (!movie_id || typeof liked !== 'boolean') {
      return res.status(400).json({ error: 'Film-ID oder Like-Status fehlt' });
    }

    console.log(`POST /api/match/${matchId}/like - User ${userId} bewertet Film ${movie_id} mit liked=${liked}`);

    // Prüfen, ob der User am Match teilnimmt
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [matchId, userId]
    );
    
    if (match.rows.length === 0) {
      console.log(`User ${userId} nimmt nicht am Match ${matchId} teil`);
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }
    
    // Like/Dislike speichern
    await pool.query(
      `INSERT INTO match_likes (match_id, player_id, movie_id, liked) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id, player_id, movie_id) 
       DO UPDATE SET liked = $4, updated_at = NOW()`,
      [matchId, userId, movie_id, liked]
    );
    
    console.log(`Like/Dislike für Film ${movie_id} von User ${userId} gespeichert`);
    
    // Prüfen, ob es ein Match gibt (beide Spieler haben den Film geliked)
    let isMatch = false;
    let matchDetails = null;
    
    if (liked) {
      // ID des anderen Spielers bestimmen
      const otherPlayerId = match.rows[0].player1_id === userId 
        ? match.rows[0].player2_id 
        : match.rows[0].player1_id;
      
      console.log(`Prüfe Match: Hat User ${otherPlayerId} den Film ${movie_id} auch geliked?`);
      
      // Prüfen, ob der andere Spieler den Film bereits bewertet hat
      const matchCheck = await pool.query(
        'SELECT * FROM match_likes WHERE match_id = $1 AND player_id = $2 AND movie_id = $3 AND liked = TRUE',
        [matchId, otherPlayerId, movie_id]
      );
      
      isMatch = matchCheck.rows.length > 0;
      
      // Wenn es ein Match gibt, hole die Filmdetails
      if (isMatch) {
        console.log(`Match gefunden! Beide Spieler mögen Film ${movie_id}`);
        
        const movieDetails = await pool.query(
          `SELECT m.*, u.username as added_by_username 
           FROM movies m
           JOIN watchlists w ON m.watchlist_id = w.id
           JOIN users u ON w.user_id = u.id
           WHERE m.id = $1`,
          [movie_id]
        );
        
        if (movieDetails.rows.length > 0) {
          matchDetails = movieDetails.rows[0];
          console.log(`Filmdetails für Match gefunden: ${matchDetails.title}`);
        }
      } else {
        console.log(`Kein Match gefunden - der andere Spieler (${otherPlayerId}) hat den Film nicht geliked`);
      }
    }
    
    res.json({ 
      message: liked ? 'Film geliked' : 'Film disliked',
      is_match: isMatch,
      match_details: matchDetails
    });
  } catch (err) {
    console.error('Fehler beim Liken/Disliken des Films:', err);
    res.status(500).json({ error: 'Fehler beim Bewerten des Films: ' + err.message });
  }
});

// Alle gemeinsamen Matches (Filme, die beide Spieler geliked haben) abrufen
app.get('/api/match/:id/matches', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const matchId = req.params.id;

    console.log(`GET /api/match/${matchId}/matches - User ${userId} ruft Matches ab`);

    // Prüfen, ob der User am Match teilnimmt
    const match = await pool.query(
      'SELECT * FROM matches WHERE id = $1 AND (player1_id = $2 OR player2_id = $2)',
      [matchId, userId]
    );
    
    if (match.rows.length === 0) {
      console.log(`User ${userId} nimmt nicht am Match ${matchId} teil`);
      return res.status(404).json({ error: 'Match nicht gefunden oder keine Berechtigung' });
    }
    
    // ID des anderen Spielers bestimmen
    const otherPlayerId = match.rows[0].player1_id === userId 
      ? match.rows[0].player2_id 
      : match.rows[0].player1_id;
    
    console.log(`Suche Matches zwischen User ${userId} und User ${otherPlayerId}`);
    
    // Gemeinsame Matches abrufen
    const movieMatches = await pool.query(
      `SELECT m.*, u.username as added_by_username 
       FROM match_likes ml1
       JOIN match_likes ml2 ON ml1.movie_id = ml2.movie_id AND ml1.match_id = ml2.match_id
       JOIN movies m ON ml1.movie_id = m.id
       JOIN watchlists w ON m.watchlist_id = w.id
       JOIN users u ON w.user_id = u.id
       WHERE ml1.match_id = $1
       AND ml1.player_id = $2
       AND ml2.player_id = $3
       AND ml1.liked = TRUE
       AND ml2.liked = TRUE
       ORDER BY m.title`,
      [matchId, userId, otherPlayerId]
    );
    
    console.log(`${movieMatches.rows.length} gemeinsame Matches gefunden`);
    
    res.json(movieMatches.rows);
  } catch (err) {
    console.error('Fehler beim Abrufen der gemeinsamen Matches:', err);
    res.status(500).json({ error: 'Fehler beim Abrufen der gemeinsamen Filme: ' + err.message });
  }
});

const groupWatchlistRouter = require('./routes/groupWatchlist');
// Router registrieren
app.use('/api/watchlist/groups', groupWatchlistRouter);

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
}); 