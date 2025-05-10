# LoginV1 Test API

Eine FastAPI-basierte Test-API für das LoginV1-Backend. Diese API dient als Testschnittstelle zur Überprüfung und Validierung der Backend-Funktionalität.

## Features

- Komplette API-Dokumentation mit Swagger UI
- Integrierte Testmöglichkeiten
- OAuth2-Authentifizierung und Tokenvalidierung
- Tests für Backend-Funktionalität

## Installation

### Voraussetzungen

- Python 3.8+ oder Docker
- LoginV1-Backend muss laufen

### Lokale Entwicklung

1. Python-Umgebung erstellen und aktivieren:

```bash
python -m venv venv
source venv/bin/activate  # Unter Windows: venv\Scripts\activate
```

2. Abhängigkeiten installieren:

```bash
pip install -r requirements.txt
```

3. Umgebungsvariablen setzen:

```bash
export BACKEND_URL="http://localhost:8000"  # URL des Backend-Services
export JWT_SECRET="your_super_secret_key"   # Muss mit dem Backend-Secret übereinstimmen
```

4. Server starten:

```bash
uvicorn app.main:app --reload --port 8001
```

### Mit Docker 

1. Docker-Image bauen:

```bash
docker build -t loginv1-testapi .
```

2. Container starten:

```bash
docker run -p 8001:8001 -e BACKEND_URL=http://backend:8000 -e JWT_SECRET=your_super_secret_key loginv1-testapi
```

## Verwendung

### API-Dokumentation

Die API-Dokumentation ist unter folgenden URLs verfügbar:

- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

### Tests ausführen

```bash
pytest
```

## Projektstruktur

```
src/testapi/
├── app/
│   ├── routers/         # API-Router nach Funktionsbereichen organisiert
│   ├── schemas/         # Pydantic-Modelle für Datenvalidierung
│   ├── tests/           # Automatisierte Tests
│   ├── config.py        # Konfigurationseinstellungen
│   ├── dependencies.py  # Abhängigkeiten (z.B. Authentifizierung)
│   └── main.py          # Hauptanwendung
├── Dockerfile           # Docker-Build-Anweisungen
├── requirements.txt     # Python-Abhängigkeiten
└── pytest.ini          # PyTest-Konfiguration
``` 