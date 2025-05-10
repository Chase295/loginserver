from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any

# Auth-Modelle
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(..., min_length=6)

class TokenResponse(BaseModel):
    token: str
    username: Optional[str] = None

class UserProfile(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: Optional[str] = None

# Watchlist-Modelle
class WatchlistResponse(BaseModel):
    message: str
    watchlistId: int

class MovieCreate(BaseModel):
    title: str
    year: Optional[int] = None
    posterUrl: Optional[str] = None
    tmdb_id: Optional[str] = None
    media_type: Optional[str] = None
    backdrop_path: Optional[str] = None
    overview: Optional[str] = None
    vote_average: Optional[float] = None
    genres: Optional[Dict[str, Any]] = None

class MovieResponse(BaseModel):
    id: int
    watchlist_id: int
    title: str
    year: Optional[int] = None
    poster_url: Optional[str] = None
    created_at: Optional[str] = None
    tmdb_id: Optional[str] = None
    media_type: Optional[str] = None
    backdrop_path: Optional[str] = None
    overview: Optional[str] = None
    vote_average: Optional[float] = None
    genres: Optional[Dict[str, Any]] = None

# Media-Modelle
class MediaItem(BaseModel):
    id: int
    title: Optional[str] = None  # für Filme
    name: Optional[str] = None   # für Serien
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    release_date: Optional[str] = None  # für Filme
    first_air_date: Optional[str] = None  # für Serien
    vote_average: Optional[float] = None

class MediaSearchResponse(BaseModel):
    page: int
    results: List[MediaItem]
    total_pages: int
    total_results: int

# API-Fehler-Modell
class ErrorResponse(BaseModel):
    error: str 