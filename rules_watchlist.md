# Watchlist-Dokumentation

## Datenbankstruktur

### Tabellen
1. **watchlists**
   ```sql
   CREATE TABLE watchlists (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE(user_id)
   );
   ```

2. **movies**
   ```sql
   CREATE TABLE movies (
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
   ```

## TMDB-Integration

### API-Endpunkte
1. **Suche**
   - Endpoint: `GET /api/search`
   - Parameter:
     - `q`: Suchbegriff
     - `type`: Medientyp (movie/tv)
   - Response: TMDB-Suchergebnisse

2. **Film-Details**
   - Endpoint: `GET /api/media/details`
   - Parameter:
     - `id`: TMDB-ID
     - `type`: Medientyp
   - Response: Detaillierte Filminformationen

3. **Trending**
   - Endpoint: `GET /api/trending`
   - Parameter:
     - `type`: Medientyp (movie/tv)
   - Response: Liste der trendenden Filme/Serien

4. **Upcoming**
   - Endpoint: `GET /api/upcoming`
   - Parameter:
     - `type`: Medientyp (movie/tv)
   - Response: Liste der kommenden Filme/Serien

### TMDB-Service
```javascript
// Hauptfunktionen
searchContent(query, type)      // Suche nach Inhalten
getMovieDetails(id)            // Film-Details
getShowDetails(id)             // Serien-Details
getStreamingProviders(id, type) // Streaming-Anbieter
getTrending(type)              // Trendende Inhalte
getUpcoming(type)              // Kommende Inhalte
```

## Backend API-Endpunkte

### 1. Watchlist erstellen/abrufen
- **Endpoint**: `POST /api/watchlist`
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "message": "Watchlist erfolgreich erstellt",
    "watchlistId": 1
  }
  ```

### 2. Film hinzufügen
- **Endpoint**: `POST /api/watchlist/movies`
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "title": "string",
    "year": "number",
    "posterUrl": "string",
    "tmdbId": "string",
    "mediaType": "string",
    "backdropPath": "string",
    "overview": "string",
    "voteAverage": "number",
    "genres": "array"
  }
  ```
- **Response**: Hinzugefügter Film mit ID

### 3. Filme abrufen
- **Endpoint**: `GET /api/watchlist/movies`
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Response**: Array von Filmen

### 4. Film löschen
- **Endpoint**: `DELETE /api/watchlist/movies/:id`
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "message": "Film erfolgreich gelöscht"
  }
  ```

## Frontend-Komponenten

### 1. Watchlist.js (Hauptkomponente)
- **Funktionen**:
  - Initialisierung der Watchlist
  - Laden der Filme
  - Hinzufügen/Löschen von Filmen
  - Einstellungen für die Discover-Seite
  - Navigation zur Discover-Seite
- **State**:
  - `loading`: Ladezustand
  - `error`: Fehlermeldungen
  - `movies`: Array der Filme
  - `settingsAnchorEl`: Anker für das Einstellungsmenü

### 2. Discover.js
- **Funktionen**:
  - Laden von trendenden/kommenden Filmen und Serien
  - Suche nach Medieninhalten
  - Hinzufügen zur Watchlist
- **State**:
  - `loading`: Ladezustand
  - `error`: Fehlermeldungen
  - `content`: Filme/Serien aus TMDB
  - `searchTerm`: Suchbegriff
  - `contentType`: Typ des Inhalts (movie/tv)
  - `displayMode`: Anzeigemodus (trending/upcoming)

### 3. SearchComponent.js
- **Props**:
  - `onAddMovie`: Callback für neue Filme
- **State**:
  - `searchTerm`: Suchbegriff
  - `loading`: Ladezustand
  - `error`: Fehlermeldungen
  - `results`: Suchergebnisse
  - `selectedType`: Ausgewählter Medientyp
- **Funktionen**:
  - `handleSearch`: TMDB-Suche
  - `handleAddMovie`: Film zur Watchlist hinzufügen

### 4. MovieCard.js
- **Props**:
  - `movie`: Filmobjekt
  - `onDelete`: Callback für Löschen
- **Filmobjekt-Struktur**:
  ```typescript
  interface Movie {
    id: number;
    title: string;
    year: number;
    posterUrl: string;
    tmdbId: string;
    mediaType: string;
    backdropPath: string;
    overview: string;
    voteAverage: number;
    genres: string[];
  }
  ```

## Benutzer-Einstellungen

### Gespeicherte Einstellungen (localStorage)
- `preferredContentType`: Bevorzugter Medientyp (movie/tv)
- `preferredDisplayMode`: Bevorzugter Anzeigemodus (trending/upcoming)

### Einstellungsmenü
- **Zugänglich über**: Zahnrad-Icon in der Watchlist
- **Optionen**:
  - Inhaltstyp: Filme oder Serien
  - Anzeigemodus: Trending oder Neu & Kommend

## Design-System

### Farben
- **Primär**: `#00ff9d` (Neon-Grün)
- **Sekundär**: `#ff00ff` (Neon-Pink)
- **Hintergrund**: Gradient von `#0a1929` zu `#1a2027`

### Komponenten-Styling
1. **Cards**:
   - Glasmorphismus-Effekt
   - Hover-Animation
   - Neon-Glow-Effekt

2. **Buttons**:
   - Primär: Neon-Grün mit dunklem Text
   - Sekundär: Neon-Pink mit Transparenz
   - "Entdecken"-Button: Outlined-Style mit Neon-Grün

3. **Textfelder**:
   - Weißer Text
   - Neon-Grüne Umrandung im Fokus

4. **Tabs und Menüs**:
   - Filme/Serien: Neon-Grün
   - Trending/Upcoming: Neon-Pink
   - Glasmorphismus-Effekt für Menüs

## Fehlerbehandlung

### Backend
1. **Authentifizierung**:
   - Token-Validierung
   - Benutzerberechtigungen

2. **Datenbank**:
   - Eindeutige Constraints
   - Fremdschlüssel-Beziehungen
   - Cascade-Delete

3. **TMDB-API**:
   - Rate Limiting
   - Fehlerbehandlung
   - Fallback-Bilder

### Frontend
1. **API-Fehler**:
   - Netzwerkfehler
   - Serverfehler
   - Validierungsfehler

2. **UI-Fehler**:
   - Ladezustände
   - Fehlermeldungen
   - Benutzer-Feedback

## Erweiterungsmöglichkeiten

### 1. TMDB-Funktionen
- Streaming-Anbieter anzeigen
- Ähnliche Filme/Serien
- Cast & Crew Details
- Trailers & Videos

### 2. Funktionen
- Kategorien für Filme
- Bewertungen
- Notizen
- Sortierung und Filterung

### 3. UI/UX
- Detailansicht für Filme
- Drag & Drop Sortierung
- Animationen
- Responsive Design-Verbesserungen

## Wartung und Updates

### Datenbank-Updates
1. Neue Tabellen hinzufügen:
   ```sql
   -- Beispiel für Kategorien
   CREATE TABLE categories (
     id SERIAL PRIMARY KEY,
     name VARCHAR(50) NOT NULL
   );

   -- Verknüpfungstabelle
   CREATE TABLE movie_categories (
     movie_id INTEGER REFERENCES movies(id),
     category_id INTEGER REFERENCES categories(id),
     PRIMARY KEY (movie_id, category_id)
   );
   ```

### Backend-Updates
1. Neue Endpunkte hinzufügen:
   ```javascript
   app.post('/api/watchlist/movies/:id/categories', ...);
   app.get('/api/watchlist/categories', ...);
   ```

### Frontend-Updates
1. Neue Komponenten:
   - `CategorySelector.js`
   - `MovieDetails.js`
   - `SortingControls.js`

## Sicherheitshinweise

1. **API-Sicherheit**:
   - JWT-Validierung
   - Rate Limiting
   - CORS-Konfiguration

2. **Datenbank-Sicherheit**:
   - Prepared Statements
   - Benutzerberechtigungen
   - Backup-Strategie

3. **Frontend-Sicherheit**:
   - XSS-Prävention
   - CSRF-Schutz
   - Sichere Speicherung von Tokens

4. **TMDB-API-Sicherheit**:
   - API-Key schützen
   - Rate Limiting beachten
   - Fehlerbehandlung 