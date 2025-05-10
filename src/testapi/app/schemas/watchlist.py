from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class WatchlistBase(BaseModel):
    id: int
    user_id: int
    created_at: datetime

class Watchlist(WatchlistBase):
    pass

class MovieBase(BaseModel):
    title: str
    year: Optional[int] = None
    poster_url: Optional[str] = None
    tmdb_id: Optional[str] = None
    media_type: Optional[str] = None
    backdrop_path: Optional[str] = None
    overview: Optional[str] = None
    vote_average: Optional[float] = None
    genres: Optional[Dict[str, Any]] = None

class MovieCreate(MovieBase):
    pass

class Movie(MovieBase):
    id: int
    watchlist_id: int
    created_at: datetime

class WatchlistResponse(BaseModel):
    message: str
    watchlist_id: int 