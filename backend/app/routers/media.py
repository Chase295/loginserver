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


@router.get("/{media_type}/{tmdb_id}/providers")
async def providers(media_type: str, tmdb_id: int, user: User = Depends(get_current_user)):
    tmdb = TMDBService()
    return await tmdb.watch_providers(media_type, tmdb_id)


# Simple in-process cache for translations (language codes don't change)
_translations_cache: dict[str, list[str]] = {}


@router.get("/{media_type}/{tmdb_id}/languages")
async def languages(media_type: str, tmdb_id: int, user: User = Depends(get_current_user)):
    cache_key = f"{media_type}_{tmdb_id}"
    if cache_key not in _translations_cache:
        tmdb = TMDBService()
        _translations_cache[cache_key] = await tmdb.translations(media_type, tmdb_id)
    return {"languages": _translations_cache[cache_key]}


@router.get("/tv/{tmdb_id}/season/{season_number}")
async def season(tmdb_id: int, season_number: int, user: User = Depends(get_current_user)):
    tmdb = TMDBService()
    return await tmdb.season(tmdb_id, season_number)


@router.get("/{media_type}/{tmdb_id}")
async def details(media_type: str, tmdb_id: int, user: User = Depends(get_current_user)):
    tmdb = TMDBService()
    return await tmdb.details(media_type, tmdb_id)
