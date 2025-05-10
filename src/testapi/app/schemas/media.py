from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class MediaItemBase(BaseModel):
    id: int
    title: Optional[str] = None
    name: Optional[str] = None  # für TV-Serien
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    vote_average: Optional[float] = None

class MovieItem(MediaItemBase):
    release_date: Optional[str] = None

class TVItem(MediaItemBase):
    first_air_date: Optional[str] = None

class MediaResponse(BaseModel):
    page: int
    results: List[Any]  # Kann MovieItem oder TVItem sein
    total_pages: int
    total_results: int 