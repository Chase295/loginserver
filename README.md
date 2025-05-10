# Login v1

Eine moderne Login-Anwendung mit Docker-Containerisierung.

## Features

- Benutzerauthentifizierung
- Registrierung und Login
- Token-basierte Authentifizierung
- Docker-Containerisierung für einfache Deployment

## Installation

1. Klonen Sie das Repository:
```bash
git clone [repository-url]
cd loginv1
```

2. Starten Sie die Docker-Container:
```bash
docker-compose up -d
```

Die Anwendung ist dann unter folgenden URLs erreichbar:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## Entwicklung

### Voraussetzungen

- Docker
- Docker Compose
- Node.js (für lokale Entwicklung)

### Lokale Entwicklung

1. Installieren Sie die Abhängigkeiten:
```bash
npm install
```

2. Starten Sie die Entwicklungsserver:
```bash
# Frontend
cd src/frontend
npm run dev

# Backend
cd src/backend
npm run dev
```

## Projektstruktur

```
loginv1/
├── src/
│   ├── frontend/    # Frontend-Anwendung
│   └── backend/     # Backend-API
├── docker-compose.yml
├── Dockerfile.frontend
└── Dockerfile.backend
```

## Lizenz

MIT 