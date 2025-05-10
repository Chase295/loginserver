from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
import os

from .config import API_DESCRIPTION, TAGS_METADATA
from .models import ErrorResponse

# Router importieren
from .routers import auth, watchlist, media

# API-Instanz erstellen mit Metadaten für Dokumentation
app = FastAPI(
    title="Login & Watchlist API",
    description=API_DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS_METADATA,
    docs_url=None,
    redoc_url=None,
)

# CORS-Konfiguration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root-Endpunkt
@app.get("/", tags=["Status"], summary="API-Status", 
         description="Überprüft, ob die API läuft.")
async def read_root():
    """
    Einfacher Endpunkt, um zu überprüfen, ob die API läuft.
    
    Gibt eine Erfolgsmeldung zurück.
    """
    return {"status": "online", "message": "Login & Watchlist API läuft"}

# Gesundheitscheck-Endpunkt
@app.get("/health", tags=["Status"], summary="Gesundheitscheck", 
         description="Überprüft den Gesundheitszustand der API.")
async def health_check():
    """
    Überprüft den Gesundheitszustand der API und gibt Statusinformationen zurück.
    
    Gibt den API-Status, die Version und weitere Informationen zurück.
    """
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
    }

# Benutzerdefinierte Swagger-UI-Route
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """
    Stellt die Swagger UI-Dokumentation bereit.
    """
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - API-Dokumentation",
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
    )

# Router einbinden
app.include_router(auth.router)
app.include_router(watchlist.router)
app.include_router(media.router)

# Fehlerhandler für 404-Fehler
@app.exception_handler(404)
async def not_found_exception_handler(request, exc):
    return ErrorResponse(error="Der angeforderte Endpunkt existiert nicht.")

# Fehlerhandler für 500-Fehler
@app.exception_handler(500)
async def server_error_exception_handler(request, exc):
    return ErrorResponse(error=f"Interner Serverfehler: {str(exc)}")

# Hauptausführungspunkt für lokale Entwicklung
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True) 