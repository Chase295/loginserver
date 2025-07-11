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

---

## Automated Deployment via GitHub Actions and GHCR

This project is configured for automated Docker image builds and publishing to the GitHub Container Registry (GHCR) using GitHub Actions. The provided `docker-compose.yaml` file allows you to run the application using these pre-built, publicly accessible images without needing to build them locally or log in to Docker.

### 1. Overview

- **GitHub Actions Workflow (`.github/workflows/docker-publish.yml`):**
    - Automatically triggers on every push to the `main` branch.
    - Builds Docker images for `nginx`, `frontend`, `backend`, and `testapi`.
    - Pushes these images to GHCR, tagged with `latest` and the commit SHA.
    - Images are stored at `ghcr.io/YOUR_GITHUB_USERNAME_LOWERCASE/SERVICE_NAME:tag`.

- **Docker Images on GHCR:**
    - `ghcr.io/YOUR_GITHUB_USERNAME_LOWERCASE/nginx:latest`
    - `ghcr.io/YOUR_GITHUB_USERNAME_LOWERCASE/frontend:latest`
    - `ghcr.io/YOUR_GITHUB_USERNAME_LOWERCASE/backend:latest`
    - `ghcr.io/YOUR_GITHUB_USERNAME_LOWERCASE/testapi:latest`
    (You will need to replace `YOUR_GITHUB_USERNAME_LOWERCASE` with your actual GitHub username in lowercase).

- **`docker-compose.yaml`:**
    - Uses the public images from GHCR.
    - Simplifies deployment to a single `docker compose up -d` command.

### 2. One-Time Setup: GitHub Personal Access Token (PAT)

For the GitHub Actions workflow to publish images to your GHCR, it needs permission. You must create a Personal Access Token (PAT) and add it as a secret to your GitHub repository.

**A. Create a Personal Access Token (PAT):**

1.  Go to your GitHub settings:
    *   Click your profile picture in the top-right corner.
    *   Go to **Settings**.
2.  Navigate to Developer settings:
    *   In the left sidebar, scroll down and click **Developer settings**.
3.  Go to Personal access tokens:
    *   Click **Personal access tokens**, then **Tokens (classic)**.
    *   *Alternatively, you can try Fine-grained tokens, but Tokens (classic) are simpler for this scope.*
4.  Generate a new token:
    *   Click **Generate new token** (and then **Generate new token (classic)** if prompted).
5.  Configure the token:
    *   **Note:** Give your token a descriptive name (e.g., `GHCR_PUBLISH_PACKAGES`).
    *   **Expiration:** Choose an appropriate expiration period.
    *   **Scopes:** Select the following scopes:
        *   `write:packages` (Crucial: Allows uploading packages/Docker images to GHCR)
        *   `read:packages` (Usually included with `write:packages`, good to have for completeness)
        *   It's good practice to grant only the necessary permissions.
6.  Generate token:
    *   Click **Generate token**.
7.  **Copy the token immediately!** This is your only chance to see it. Store it securely for the next step.

**B. Add the PAT as a GitHub Repository Secret:**

1.  Go to your GitHub repository.
2.  Click the **Settings** tab.
3.  In the left sidebar, under "Security", click **Secrets and variables**, then **Actions**.
4.  Click **New repository secret**.
5.  **Name:** Enter `GH_PAT` (this exact name is used in the `docker-publish.yml` workflow).
6.  **Secret/Value:** Paste the PAT you copied in the previous step.
7.  Click **Add secret**.

Once this secret is added, the GitHub Actions workflow will have the necessary permissions to push images to GHCR. The first push to `main` after adding the workflow file and this secret will trigger the image building and publishing process.

### 3. Ensure Public Package Visibility on GHCR

After the GitHub Action successfully runs for the first time and pushes the packages (images) to GHCR, you need to ensure these packages are **publicly visible**.

1.  Go to your GitHub profile page (not the repository).
2.  Click on the **Packages** tab.
3.  You should see the newly published packages (e.g., `nginx`, `frontend`, `backend`, `testapi`).
4.  For each package:
    *   Click on the package name.
    *   On the package's page, find **Package settings** (usually on the right sidebar).
    *   Under "Danger Zone" or "Visibility settings", ensure the package visibility is set to **Public**. If it's private, change it to public.

This makes the images pullable by anyone without requiring a `docker login` to GHCR.

### 4. Running the Application with `docker-compose.yaml`

1.  **Clone the Repository (if you haven't already):**
    ```bash
    git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
    cd YOUR_REPOSITORY_NAME
    ```

2.  **Prepare `docker-compose.yaml`:**
    *   Open the `docker-compose.yaml` file.
    *   Replace all instances of `YOUR_GITHUB_USERNAME_LOWERCASE` with your actual GitHub username (in lowercase letters).
    *   **Crucially, replace the `!!!YOUR_STRONG_JWT_SECRET_HERE!!!` placeholders** for the `JWT_SECRET` in both the `backend` and `testapi` services with the *same, strong, unique secret key*.
    *   Optionally, change the `POSTGRES_PASSWORD` for the `db` service from `postgres_CHANGE_ME` to a more secure password. Ensure the `DATABASE_URL` in the `backend` service reflects this if you change the user/password (though the default setup uses `postgres:postgres_CHANGE_ME`).

3.  **Start the Application:**
    ```bash
    docker compose up -d
    ```
    (Note: some systems might still use `docker-compose` instead of `docker compose`)

    This command will:
    *   Pull the pre-built public images from GHCR for `nginx`, `frontend`, `backend`, and `testapi`.
    *   Start all services in detached mode.

4.  **Accessing the Application:**
    *   Once the containers are running (check with `docker compose ps`), open your web browser and navigate to `http://localhost`.
    *   Nginx will serve the frontend, and API calls will be routed to the backend.

### 5. Environment Variables & Configuration

-   **`JWT_SECRET`**: Must be set in `docker-compose.yaml` for `backend` and `testapi` services.
-   **`TMDB_API_KEY` & `TMDB_ACCESS_TOKEN`**: These are pre-filled in `docker-compose.yaml` as per your earlier provision but ensure they are correct.
-   **`CORS_ALLOWED_ORIGINS`**: Configured in `docker-compose.yaml` for the `backend` service. The default `http://localhost` should work when accessing Nginx on port 80 of your host.
-   **Database Credentials**: The `db` service uses `postgres` as the user and `postgres_CHANGE_ME` as the password by default. The `backend`'s `DATABASE_URL` is configured to use these. Change `POSTGRES_PASSWORD` for better security.

### 6. Stopping the Application

-   To stop all services:
    ```bash
    docker compose down
    ```
-   To stop and remove volumes (e.g., to reset the database):
    ```bash
    docker compose down -v
    ```

### 7. Troubleshooting

-   **Image Not Found:**
    *   Ensure the GitHub Actions workflow has run successfully after your latest push to `main`.
    *   Verify the image names in `docker-compose.yaml` exactly match those on GHCR (including your lowercase GitHub username).
    *   Check that the packages on GHCR are set to **public visibility**.
-   **Application Errors:**
    *   Check container logs:
        ```bash
        docker compose logs nginx
        docker compose logs frontend
        docker compose logs backend
        docker compose logs db
        docker compose logs testapi
        ```
-   **PAT Issues:**
    *   If GitHub Actions fail with authentication errors when pushing to GHCR, double-check your `GH_PAT` secret in the repository settings and ensure the PAT has the `write:packages` scope.

---

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