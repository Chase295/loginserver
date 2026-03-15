import logging
import time
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Movie, TautulliServer, User, UserPlexConnection, Watchlist

logger = logging.getLogger(__name__)


async def _tautulli_request(url: str, api_key: str, cmd: str, params: dict | None = None) -> dict:
    """Make a request to the Tautulli API."""
    request_params = {"apikey": api_key, "cmd": cmd, **(params or {})}
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(f"{url}/api/v2", params=request_params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    if data.get("response", {}).get("result") != "success":
        raise ValueError(data.get("response", {}).get("message", "Tautulli API error"))
    return data["response"]["data"]


async def test_connection(url: str, api_key: str) -> dict:
    """Test Tautulli connection and return server info."""
    data = await _tautulli_request(url, api_key, "get_tautulli_info")
    return {"status": "ok", "version": data.get("tautulli_version", "unknown")}


async def get_user_history(
    url: str, api_key: str, plex_username: str,
    media_type: str | None = None, start_date: str | None = None, length: int = 200,
) -> list[dict]:
    """Get watch history for a specific Plex user."""
    params = {"user": plex_username, "length": min(length, 10000)}
    if media_type:
        params["media_type"] = media_type
    if start_date:
        params["start_date"] = start_date
    data = await _tautulli_request(url, api_key, "get_history", params)
    return data.get("data", [])


async def get_metadata(url: str, api_key: str, rating_key: int) -> dict:
    """Get metadata for a specific item from Tautulli."""
    return await _tautulli_request(url, api_key, "get_metadata", {"rating_key": str(rating_key)})


def _extract_tmdb_id(guids: list | None) -> int | None:
    """Extract TMDB ID from Tautulli guid list."""
    if not guids:
        return None
    for guid in guids:
        val = guid if isinstance(guid, str) else str(guid)
        if "tmdb://" in val:
            try:
                return int(val.split("tmdb://")[1].split("/")[0].strip())
            except (ValueError, IndexError):
                continue
    return None


async def _resolve_tmdb_id(url: str, api_key: str, rating_key: int, cache: dict, title: str | None = None, year: str | None = None, media_type: str | None = None) -> int | None:
    """Resolve a rating_key to a TMDB ID via get_metadata, with TMDB search fallback."""
    if rating_key in cache:
        return cache[rating_key]

    # Try Tautulli metadata first
    try:
        meta = await get_metadata(url, api_key, rating_key)
        tmdb_id = _extract_tmdb_id(meta.get("guids"))
        if tmdb_id:
            cache[rating_key] = tmdb_id
            return tmdb_id
    except Exception:
        pass

    # Fallback: search TMDB by title (for imported items not on current Plex)
    if title:
        try:
            from ..services.tmdb import TMDBService
            tmdb = TMDBService()
            search_results = await tmdb.search(title)
            for r in (search_results.get("results") or []):
                r_type = r.get("media_type", "")
                r_title = (r.get("title") or r.get("name") or "").lower()
                r_year = (r.get("release_date") or r.get("first_air_date") or "")[:4]

                # Match by type if we know it
                if media_type == "movie" and r_type != "movie":
                    continue
                if media_type in ("episode", "show") and r_type != "tv":
                    continue

                # Match by title (exact or close)
                if r_title == title.lower() or r_title == title.lower().split(" - ")[0]:
                    # If year is available, verify
                    if year and r_year and r_year != str(year):
                        continue
                    tmdb_id = r.get("id")
                    cache[rating_key] = tmdb_id
                    return tmdb_id
            # If no exact match, use first result of matching type
            for r in (search_results.get("results") or []):
                r_type = r.get("media_type", "")
                if media_type == "movie" and r_type == "movie":
                    cache[rating_key] = r.get("id")
                    return r.get("id")
                if media_type in ("episode", "show") and r_type == "tv":
                    cache[rating_key] = r.get("id")
                    return r.get("id")
        except Exception as e:
            logger.debug(f"TMDB search fallback failed for '{title}': {e}")

    cache[rating_key] = None
    return None


async def sync_user_history(
    user: User, conn: UserPlexConnection, server: TautulliServer, db: AsyncSession,
) -> dict:
    """Sync Tautulli watch history for a single user+server connection."""
    # Get user's default watchlist
    result = await db.execute(
        select(Watchlist).where(Watchlist.owner_id == user.id, Watchlist.is_default == True)
    )
    default_watchlist = result.scalar_one_or_none()
    if not default_watchlist:
        return {"error": "No default watchlist found"}

    start_date = None
    if conn.last_sync:
        start_date = conn.last_sync.strftime("%Y-%m-%d")

    url, api_key = server.url, server.api_key
    added = 0
    updated = 0
    total = 0
    metadata_cache: dict[int, int | None] = {}

    # --- Sync Movies ---
    try:
        movie_history = await get_user_history(url, api_key, conn.plex_username, media_type="movie", start_date=start_date, length=10000)
    except Exception as e:
        logger.error(f"Failed to fetch movie history for {user.username} on {server.name}: {e}")
        movie_history = []

    for entry in movie_history:
        total += 1
        rating_key = entry.get("rating_key")
        if not rating_key:
            continue

        entry_title = entry.get("full_title") or entry.get("title")
        entry_year = str(entry.get("year", "")) if entry.get("year") else None
        tmdb_id = await _resolve_tmdb_id(url, api_key, rating_key, metadata_cache, title=entry_title, year=entry_year, media_type="movie")
        if not tmdb_id:
            continue

        result = await db.execute(
            select(Movie).join(Watchlist).where(
                Watchlist.owner_id == user.id,
                Movie.tmdb_id == tmdb_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            if existing.status not in ("watched", "dropped"):
                existing.status = "watched"
                updated += 1
        else:
            movie = Movie(
                watchlist_id=default_watchlist.id,
                title=entry.get("full_title", entry.get("title", "Unknown")),
                year=str(entry.get("year", "")) if entry.get("year") else None,
                tmdb_id=tmdb_id,
                media_type="movie",
                status="watched",
            )
            db.add(movie)
            added += 1

    # --- Sync TV Shows ---
    try:
        episode_history = await get_user_history(url, api_key, conn.plex_username, media_type="episode", start_date=start_date, length=10000)
    except Exception as e:
        logger.error(f"Failed to fetch episode history for {user.username} on {server.name}: {e}")
        episode_history = []

    shows: dict[int, dict] = {}
    for entry in episode_history:
        total += 1
        gp_key = entry.get("grandparent_rating_key")
        if not gp_key:
            continue
        gp_key = int(gp_key)
        if gp_key not in shows:
            shows[gp_key] = {
                "title": entry.get("grandparent_title", "Unknown"),
                "year": entry.get("year"),
                "watched_episodes": {},
            }
        season_num = entry.get("parent_media_index")
        ep_num = entry.get("media_index")
        if season_num and ep_num:
            season_key = str(int(season_num))
            if season_key not in shows[gp_key]["watched_episodes"]:
                shows[gp_key]["watched_episodes"][season_key] = set()
            shows[gp_key]["watched_episodes"][season_key].add(int(ep_num))

    from ..services.tmdb import TMDBService
    tmdb = TMDBService()

    for gp_key, show_data in shows.items():
        tmdb_id = await _resolve_tmdb_id(url, api_key, gp_key, metadata_cache, title=show_data["title"], year=str(show_data.get("year", "")) if show_data.get("year") else None, media_type="show")
        if not tmdb_id:
            continue

        watch_progress = {
            season: sorted(list(eps))
            for season, eps in show_data["watched_episodes"].items()
        }

        try:
            tmdb_data = await tmdb.details("tv", tmdb_id)
            tmdb_seasons = [s for s in (tmdb_data.get("seasons") or []) if s.get("season_number", 0) > 0]
            total_episodes = sum(s.get("episode_count", 0) for s in tmdb_seasons)
            total_watched = sum(len(eps) for eps in watch_progress.values())
            is_complete = total_watched >= total_episodes and total_episodes > 0
        except Exception:
            is_complete = False

        status = "watched" if is_complete else "watching"

        result = await db.execute(
            select(Movie).join(Watchlist).where(
                Watchlist.owner_id == user.id,
                Movie.tmdb_id == tmdb_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            old_progress = existing.watch_progress or {}
            for season, eps in watch_progress.items():
                old_eps = set(old_progress.get(season, []))
                old_eps.update(eps)
                old_progress[season] = sorted(list(old_eps))
            existing.watch_progress = old_progress
            if existing.status not in ("dropped", "watched"):
                existing.status = status
            updated += 1
        else:
            movie = Movie(
                watchlist_id=default_watchlist.id,
                title=show_data["title"],
                year=str(show_data["year"]) if show_data["year"] else None,
                tmdb_id=tmdb_id,
                media_type="tv",
                status=status,
                watch_progress=watch_progress,
            )
            db.add(movie)
            added += 1

    conn.last_sync = datetime.utcnow()
    await db.flush()

    return {"added": added, "updated": updated, "total_entries": total}


async def sync_all_connected_users(db: AsyncSession) -> dict:
    """Sync Tautulli history for all users with Plex connections."""
    result = await db.execute(
        select(UserPlexConnection, TautulliServer, User)
        .join(TautulliServer)
        .join(User)
    )
    rows = result.all()

    results = {}
    for conn, server, user in rows:
        key = f"{user.username}@{server.name}"
        results[key] = await sync_user_history(user, conn, server, db)

    return results


# --- Plex Library Availability ---

# Per-server cache: server_id -> { tmdb_id -> {library, title} }
_plex_library_caches: dict[int, dict[int, dict]] = {}
_plex_cache_times: dict[int, float] = {}
PLEX_CACHE_TTL = 600  # 10 minutes


async def _build_plex_library_cache(url: str, api_key: str, server_id: int) -> None:
    """Build a mapping of TMDB ID -> library info for all Plex content on a server."""
    global _plex_library_caches, _plex_cache_times

    try:
        libraries = await _tautulli_request(url, api_key, "get_libraries")
    except Exception:
        return

    cache: dict[int, dict] = {}
    for lib in libraries:
        section_id = lib.get("section_id")
        section_type = lib.get("section_type")
        if section_type not in ("movie", "show"):
            continue

        try:
            lib_data = await _tautulli_request(
                url, api_key, "get_library_media_info",
                {"section_id": section_id, "length": 2000},
            )
        except Exception:
            continue

        for item in lib_data.get("data", []):
            rating_key = item.get("rating_key")
            if not rating_key:
                continue
            try:
                meta = await _tautulli_request(
                    url, api_key, "get_metadata", {"rating_key": str(rating_key)},
                )
                item_tmdb = _extract_tmdb_id(meta.get("guids"))
                if item_tmdb:
                    cache[item_tmdb] = {
                        "library": lib.get("section_name"),
                        "title": meta.get("title", item.get("title")),
                    }
            except Exception:
                continue

    _plex_library_caches[server_id] = cache
    _plex_cache_times[server_id] = time.time()
    logger.info(f"Plex library cache built for server {server_id}: {len(cache)} titles")


async def check_plex_availability(url: str, api_key: str, tmdb_id: int, server_id: int) -> dict:
    """Check if a title is available in a Plex library."""
    if time.time() - _plex_cache_times.get(server_id, 0) > PLEX_CACHE_TTL:
        await _build_plex_library_cache(url, api_key, server_id)

    cache = _plex_library_caches.get(server_id, {})
    if tmdb_id in cache:
        info = cache[tmdb_id]
        return {"available": True, "library": info["library"], "title": info["title"]}
    return {"available": False}
