# Login-Projekt Dokumentation

## Projektstruktur
```
loginv1/
├── docker-compose.yml
├── src/
│   ├── frontend/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Welcome.js
│   │   │   │   ├── Login.js
│   │   │   │   ├── Register.js
│   │   │   │   └── Dashboard.js
│   │   │   ├── App.js
│   │   │   └── index.js
│   │   ├── package.json
│   │   └── Dockerfile
│   └── backend/
│       ├── src/
│       │   └── index.js
│       ├── package.json
│       └── Dockerfile
```

## Datenbank
### PostgreSQL Konfiguration
- **Port**: 5432
- **Benutzer**: postgres
- **Passwort**: postgres
- **Datenbank**: loginapp

### Tabellenstruktur
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Datenbank zurücksetzen
```bash
docker-compose down -v
docker volume rm loginv1_postgres_data
docker-compose up --build
```

## Backend (Node.js/Express)
### Port: 8000

### API-Endpunkte
1. **Registrierung**
   - Endpunkt: `POST /api/register`
   - Body:
     ```json
     {
       "username": "string",
       "email": "string",
       "password": "string"
     }
     ```
   - Validierungen:
     - Alle Felder müssen ausgefüllt sein
     - Passwort mindestens 6 Zeichen
     - E-Mail und Benutzername müssen eindeutig sein

2. **Login**
   - Endpunkt: `POST /api/login`
   - Body:
     ```json
     {
       "email": "string",
       "password": "string"
     }
     ```
   - Rückgabe: JWT-Token und Benutzername

### Umgebungsvariablen
- `DATABASE_URL`: PostgreSQL Verbindungsstring
- `JWT_SECRET`: Geheimer Schlüssel für JWT

## Frontend (React)
### Port: 3000

### Komponenten
1. **Welcome.js**
   - Willkommensseite mit Links zu Login/Register
   - Futuristisches Design mit Gradienten
   - Responsive für mobile Geräte

2. **Login.js**
   - Login-Formular mit E-Mail und Passwort
   - Validierung der Eingaben
   - Fehlerbehandlung
   - Weiterleitung zum Dashboard bei erfolgreichem Login

3. **Register.js**
   - Registrierungsformular mit:
     - E-Mail (autoComplete="email")
     - Benutzername (autoComplete="username")
     - Passwort (autoComplete="new-password")
     - Passwort bestätigen
   - Validierung der Eingaben
   - Fehlerbehandlung
   - Weiterleitung zum Login bei erfolgreicher Registrierung

4. **Dashboard.js**
   - Geschützte Route (nur mit gültigem Token)
   - Zeigt Benutzernamen an
   - Logout-Funktion
   - Platzhalter für zukünftige Funktionen

### Design
- **Theme**: Dunkles Theme mit futuristischen Akzenten
- **Farben**:
  - Primär: #00ff9d (Neon-Grün)
  - Sekundär: #ff00ff (Neon-Pink)
  - Hintergrund: Gradient von #0a1929 zu #1a2027
- **Schriftarten**: Roboto
- **Responsive Design**: Anpassung für mobile Geräte

## Docker
### Container
1. **Frontend**
   - Node.js 18 Alpine
   - Port: 3000
   - Volumes: ./src/frontend:/app

2. **Backend**
   - Node.js 18 Alpine
   - Port: 8000
   - Umgebungsvariablen für DB und JWT

3. **PostgreSQL**
   - Version: 15
   - Port: 5432
   - Persistente Daten: postgres_data Volume

### Starten des Projekts
```bash
# Erstmalig oder nach Änderungen
docker-compose up --build

# Nur Backend neu starten
docker-compose up --build backend

# Nur Frontend neu starten
docker-compose up --build frontend
```

## Fehlerbehebung
1. **Datenbankverbindung fehlgeschlagen**
   - Prüfen Sie, ob PostgreSQL läuft
   - Warten Sie 5-10 Sekunden nach dem Start
   - Prüfen Sie die Umgebungsvariablen

2. **Registrierung fehlgeschlagen**
   - Prüfen Sie die Validierungen
   - E-Mail und Benutzername müssen eindeutig sein
   - Passwort mindestens 6 Zeichen

3. **Login fehlgeschlagen**
   - Prüfen Sie E-Mail und Passwort
   - Token wird im localStorage gespeichert

4. **Frontend nicht erreichbar**
   - Prüfen Sie Port 3000
   - Node-Module neu installieren

## Sicherheitshinweise
1. **Passwörter**
   - Werden mit bcrypt gehasht
   - Mindestlänge: 6 Zeichen

2. **JWT**
   - 24 Stunden gültig
   - Enthält userId und email

3. **CORS**
   - Aktiviert für Frontend (Port 3000)

## Anpassungen
1. **Design ändern**
   - Theme in App.js anpassen
   - Farben in den Komponenten

2. **Validierungen erweitern**
   - Backend: index.js
   - Frontend: Register.js/Login.js

3. **Dashboard erweitern**
   - Dashboard.js anpassen
   - Neue Komponenten hinzufügen

4. **Datenbank erweitern**
   - Neue Tabellen in initDb() hinzufügen
   - Backend neu starten 