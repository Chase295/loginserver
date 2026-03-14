# Watchlist v2.0

Eine mobile-first Watchlist-App mit Glassmorphism-UI im Overseerr-Style.

## Tech Stack

- **Backend:** FastAPI (Python 3.12), SQLAlchemy Async, PostgreSQL
- **Frontend:** React 18 + Vite + Tailwind CSS, Framer Motion
- **Infra:** Docker Compose, Nginx Reverse Proxy

## Features

- Benutzer-Registrierung & Login (JWT Auth, bcrypt)
- Persönliche Watchlist mit Filmen & Serien
- TMDB-Integration (Suche, Trending, Details)
- Freundschaftssystem mit Watchlist-Sharing
- Gruppen-Watchlists
- Multiplayer-Matching (gemeinsam Filme finden)
- Privatsphäre-Einstellungen (private Titel, Tags, Sichtbarkeit)
- Mobile-First Glassmorphism UI

## Setup

```bash
# 1. .env erstellen
cp .env.example .env
# .env anpassen (JWT_SECRET, TMDB Keys, etc.)

# 2. Starten
docker compose up -d --build

# App läuft auf http://localhost
```

## Entwicklung

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
# Läuft auf http://localhost:5173 mit API-Proxy zu :8000
```

## API

FastAPI Swagger-Docs: `http://localhost:8000/docs`

### Endpoints

| Bereich | Prefix | Beschreibung |
|---------|--------|-------------|
| Auth | `/api/auth` | Register, Login, Me |
| Watchlist | `/api/watchlist` | CRUD Filme, Settings |
| Freunde | `/api/friends` | Anfragen, Liste, Level |
| Matches | `/api/match` | Einladungen, Lobby, Voting |
| Gruppen | `/api/groups` | Erstellen, Einladen, Filme |
| Medien | `/api/media` | TMDB Suche, Trending |

## Projektstruktur

```
├── backend/           # FastAPI Backend
│   ├── app/
│   │   ├── main.py    # App & Startup
│   │   ├── models.py  # SQLAlchemy Models
│   │   ├── schemas.py # Pydantic Schemas
│   │   ├── auth.py    # JWT & Password Utils
│   │   ├── routers/   # API Endpoints
│   │   └── services/  # TMDB Service
│   └── Dockerfile
├── frontend/          # React Frontend
│   ├── src/
│   │   ├── pages/     # Seiten-Komponenten
│   │   ├── components/# Shared Components
│   │   ├── context/   # Auth Context
│   │   └── api/       # Axios Client
│   └── Dockerfile
├── nginx/             # Reverse Proxy
├── docker-compose.yaml
└── .env.example
```
