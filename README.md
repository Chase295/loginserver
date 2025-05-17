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

# Watchlist & Friends App

## Überblick

Diese App bietet eine moderne Watchlist-Verwaltung mit Social-Features (Freunde, Multiplayer, Privatsphäre). Nutzer können Filme/Serien verwalten, bewerten, taggen, privat stellen und mit Freunden interagieren. Die Daten werden in einer PostgreSQL-Datenbank gespeichert und über ein Node.js/Express-Backend bereitgestellt. Das Frontend ist in React umgesetzt.

---

## Datenbankstruktur (relevant für Privatsphäre)

- **Tabelle `movies`**
  - Jeder Filmeintrag gehört zu einer Watchlist (Fremdschlüssel `watchlist_id`).
  - Felder:
    - `id`, `title`, `year`, `poster_url`, ...
    - `is_private` (BOOLEAN): Gibt an, ob der Film/Serie privat ist (nur für den Besitzer sichtbar).
    - `tags` (JSONB): Array von Tag-Objekten, z.B. `[ { label: "Horror", color: "#ff0000", is_private: true }, ... ]`

- **Tabelle `watchlists`**
  - Zentrale Verwaltung der Watchlist eines Users.
  - Felder `private_tags` und `private_titles` werden nur noch als Hilfsfelder genutzt, die eigentliche Privatsphäre wird direkt in `movies` und den Tag-Objekten gespeichert.

---

## Privatsphäre-Logik

### Private Titel (Filme/Serien)
- Das Feld `is_private` in der Tabelle `movies` steuert, ob ein Titel privat ist.
- Wird im Detail-Modal (Bearbeitungsdialog) oder in den Einstellungen (Tab "Ausnahmen") gesetzt/entfernt.
- Synchronisation:
  - Änderungen im Modal oder in den Einstellungen werden direkt in der DB gespeichert.
  - Beim Öffnen der Einstellungen werden alle Titel mit `is_private: true` automatisch als privat angezeigt.

### Private Tags
- Jeder Tag im Feld `tags` eines Films kann das Feld `is_private: true` haben.
- Wird im Detail-Modal (beim Bearbeiten eines Films) oder in den Einstellungen gesetzt/entfernt.
- Synchronisation:
  - Änderungen im Modal oder in den Einstellungen werden auf alle Filme angewendet, die diesen Tag enthalten.
  - Beim Öffnen der Einstellungen werden alle Tags, die in irgendeinem Film `is_private: true` haben, als privat angezeigt.

### Anzeige/Filterung für andere User
- Ein Film/Serie wird für andere User **nicht angezeigt**, wenn:
  - `is_private` für den Film/Serie auf `true` steht **oder**
  - einer der Tags im Feld `tags` das Feld `is_private: true` hat.
- Ein einziger privater Tag reicht aus, damit der gesamte Film für andere User nicht sichtbar ist.

---

## Synchronisation Einstellungen & Modal
- Beim Öffnen des Einstellungsfensters werden die privaten Titel und Tags immer aus der Datenbank geladen (echter Stand).
- Änderungen im Einstellungsfenster werden direkt in der Tabelle `movies` übernommen (PUT-Requests für alle betroffenen Filme).
- Das Detail-Modal und die Einstellungen greifen auf dieselbe Datenbasis zu und sind immer synchron.

---

## Beispiel-Datenstruktur (Film mit mehreren Tags)

```json
{
  "id": 27,
  "title": "One Piece",
  "is_private": false,
  "tags": [
    { "label": "Horror", "color": "#ff0000", "is_private": true },
    { "label": "Action", "color": "#00ff00", "is_private": false }
  ]
}
```
- In diesem Beispiel ist der Film öffentlich, aber der Tag "Horror" ist privat. Für andere User ist der gesamte Film nicht sichtbar.

---

## Wichtige Endpunkte (Backend)
- `GET /api/watchlist/movies` – Gibt alle Filme/Serien des eingeloggten Users zurück (inkl. Privat-Status und Tags)
- `PUT /api/watchlist/movies/:id` – Aktualisiert einen Filmeintrag (inkl. is_private und Tags)
- `PUT /api/watchlist/settings` – Speichert zentrale Einstellungen, synchronisiert aber auch alle betroffenen Filme/Tags
- `GET /api/watchlist/user/:username` – Gibt die Watchlist eines anderen Users zurück (filtert private Titel/Tags heraus)

---

## Frontend-Logik
- Das Detail-Modal (Bearbeiten eines Titels) und das Einstellungsfenster (Tab "Ausnahmen") sind immer synchron mit der Datenbank.
- Änderungen an Privatsphäre-Einstellungen werden sofort übernommen und wirken sich auf die Anzeige für andere User aus.
- Die Filter- und Suchfunktionen sind identisch für eigene und fremde Watchlists.

---

## Hinweise für Entwickler/KI
- Die Privatsphäre-Logik ist **zentralisiert**: Es gibt keine doppelten oder verteilten Privatsphäre-Informationen mehr.
- Änderungen an privaten Titeln oder Tags müssen immer über die Felder `is_private` in `movies` bzw. im Tag-Objekt erfolgen.
- Die Synchronisation zwischen Einstellungen und Detail-Modal ist über einen `useEffect` auf `settingsOpen` im Frontend gelöst.
- Die Backend-Logik filtert für andere User immer korrekt nach diesen Feldern.

---

## Weiterentwicklung
- Neue Privatsphäre-Features können einfach durch Erweiterung der Felder in `movies` oder im Tag-Objekt umgesetzt werden.
- Die Filter- und Synchronisationslogik ist modular und kann leicht angepasst werden.

---

**Letzter Stand: Alle Privatsphäre-Features sind konsistent, synchron und direkt in der Datenbank abgebildet.** 