from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, watchlist, friends, match, group_watchlist
from database import Base, engine

# Datenbank-Tabellen erstellen
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS-Middleware konfigurieren
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router einbinden
app.include_router(auth.router)
app.include_router(watchlist.router)
app.include_router(friends.router)
app.include_router(match.router)
app.include_router(group_watchlist.router)

@app.get("/")
def read_root():
    return {"message": "Willkommen bei der Watchlist API!"} 