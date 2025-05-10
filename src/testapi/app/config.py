import os
from typing import Dict, Any

# Umgebungsvariablen für die Konfiguration
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
JWT_SECRET = os.getenv("JWT_SECRET", "your_jwt_secret_key")
TEST_USERNAME = os.getenv("TEST_USERNAME", "testuser")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "password123")
TEST_EMAIL = os.getenv("TEST_EMAIL", "test@example.com")

# Feature-Flags für Module
class FeatureFlags:
    # Aktiviert/deaktiviert die Watchlist-Funktionalität
    ENABLE_WATCHLIST = os.getenv("ENABLE_WATCHLIST", "true").lower() == "true"
    
    # Aktiviert/deaktiviert die Medien-Suche
    ENABLE_MEDIA_SEARCH = os.getenv("ENABLE_MEDIA_SEARCH", "true").lower() == "true"
    
    # Aktiviert/deaktiviert die Benutzerprofile
    ENABLE_USER_PROFILES = os.getenv("ENABLE_USER_PROFILES", "true").lower() == "true"

# API-Endpunkte des Backends
class BackendEndpoints:
    # Auth-Endpunkte
    AUTH_REGISTER = f"{BACKEND_URL}/api/register"
    AUTH_LOGIN = f"{BACKEND_URL}/api/login"
    
    # Watchlist-Endpunkte
    WATCHLIST = f"{BACKEND_URL}/api/watchlist"
    WATCHLIST_MOVIES = f"{BACKEND_URL}/api/watchlist/movies"
    WATCHLIST_MOVIE = lambda movie_id: f"{BACKEND_URL}/api/watchlist/movies/{movie_id}"
    
    # Media-Endpunkte
    MEDIA_TRENDING = f"{BACKEND_URL}/api/media/trending"
    MEDIA_UPCOMING = f"{BACKEND_URL}/api/media/upcoming"
    MEDIA_SEARCH = f"{BACKEND_URL}/api/media/search"

# API-Konfiguration
TAGS_METADATA = [
    {"name": "Status", "description": "Basis-Endpunkte zum Status der API"},
    {"name": "Auth", "description": "Authentifizierungs-Endpunkte (Registrierung, Login)"},
    {"name": "Watchlist", "description": "Endpunkte zum Verwalten der Watchlist"},
    {"name": "Media", "description": "Endpunkte zum Durchsuchen von Filmen und Serien"},
]

# API-Beschreibung für Swagger/OpenAPI-Dokumentation
API_DESCRIPTION = """
# Login Test API

Diese API bietet Zugriff auf alle Funktionen des Login-Systems und der Watchlist-Anwendung.
Jede Funktion, die in der Web-UI verfügbar ist, kann auch über diese API genutzt werden.

## Module

Die API ist modular aufgebaut:
- **Auth**: Registrierung, Login und Token-Validierung
- **Watchlist**: Verwaltung der persönlichen Watchlist (Filme/Serien hinzufügen, entfernen, auflisten)
- **Media**: Durchsuchen von Filmen/Serien, Trending, Upcoming

## Verwendung

Für geschützte Endpunkte muss ein gültiges JWT-Token im Authorization-Header mitgesendet werden:
```
Authorization: Bearer <token>
```

Dieses Token erhalten Sie durch Registrierung oder Login.
""" 