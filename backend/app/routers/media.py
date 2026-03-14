from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user
from ..models import User
from ..services.tmdb import TMDBService

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/search")
async def search(q: str = Query(..., min_length=1), user: User = Depends(get_current_user)):
    tmdb = TMDBService()
    return await tmdb.search(q)


@router.get("/trending")
async def trending(page: int = 1, user: User = Depends(get_current_user)):
    tmdb = TMDBService()
    return await tmdb.trending(page)


@router.get("/upcoming")
async def upcoming(page: int = 1, user: User = Depends(get_current_user)):
    tmdb = TMDBService()
    return await tmdb.upcoming(page)


@router.get("/{media_type}/{tmdb_id}")
async def details(media_type: str, tmdb_id: int, user: User = Depends(get_current_user)):
    tmdb = TMDBService()
    return await tmdb.details(media_type, tmdb_id)
