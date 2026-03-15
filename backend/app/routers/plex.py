from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import logging

from ..auth import get_current_user, require_admin, require_installer
from ..database import async_session, get_db
from ..models import Movie, PlexServer, User, Watchlist
from ..services import plex as plex_service
from ..services.tmdb import TMDBService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plex", tags=["plex"])


async def _get_server(server_id: int, db: AsyncSession) -> PlexServer:
    result = await db.execute(select(PlexServer).where(PlexServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")
    return server


# --- Admin: Server CRUD ---


@router.get("/servers")
async def list_servers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlexServer).order_by(PlexServer.created_at))
    servers = result.scalars().all()
    if user.is_admin:
        return [{"id": s.id, "name": s.name, "url": s.url, "enabled": s.enabled, "machine_id": s.machine_id, "created_at": str(s.created_at)} for s in servers]
    return [{"id": s.id, "name": s.name, "enabled": s.enabled} for s in servers]


@router.post("/servers")
async def add_server(data: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    url = data["url"].rstrip("/")
    token = data["token"]
    name = data.get("name", "")

    # Test connection and get server info
    try:
        info = await plex_service.test_connection(url, token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verbindung fehlgeschlagen: {e}")

    if not name:
        name = info.get("name", "Plex Server")

    server = PlexServer(
        name=name,
        url=url,
        token=token,
        machine_id=info.get("machine_id"),
    )
    db.add(server)
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url, "version": info.get("version")}


@router.put("/servers/{server_id}")
async def update_server(server_id: int, data: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    if "name" in data:
        server.name = data["name"]
    if "url" in data:
        server.url = data["url"].rstrip("/")
    if "token" in data:
        server.token = data["token"]
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url}


@router.post("/discover")
async def discover_servers(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Auto-discover all Plex servers (owned + shared) and add missing ones."""
    # Find a plex token (from user or existing server)
    token = user.plex_token
    if not token:
        result = await db.execute(select(PlexServer).limit(1))
        existing_srv = result.scalar_one_or_none()
        if existing_srv:
            token = existing_srv.token
    if not token:
        raise HTTPException(status_code=400, detail="Kein Plex-Token vorhanden. Bitte zuerst mit Plex anmelden.")

    discovered = await plex_service.discover_servers(token)
    if not discovered:
        return {"added": 0, "total": 0, "servers": []}

    # Get existing servers by machine_id
    result = await db.execute(select(PlexServer))
    existing = {s.machine_id: s for s in result.scalars().all() if s.machine_id}

    added = 0
    servers_info = []
    import re
    ip_pattern = re.compile(r'https?://\d+\.\d+\.\d+\.\d+')

    for srv in discovered:
        mid = srv["machine_id"]
        if mid in existing:
            ex = existing[mid]
            # Only update URL if current URL is an IP address (not a custom domain/dyndns)
            new_url = srv["url"].rstrip("/")
            if ex.url != new_url and ip_pattern.match(ex.url):
                ex.url = new_url
            # Always update token (shared servers have unique tokens)
            if srv.get("token"):
                ex.token = srv["token"]
            servers_info.append({"name": srv["name"], "status": "exists", "owned": srv["owned"]})
            continue

        # Add new server with server-specific token
        new_server = PlexServer(
            name=srv["name"],
            url=srv["url"].rstrip("/"),
            token=srv.get("token", token),
            machine_id=mid,
            enabled=True,
        )
        db.add(new_server)
        added += 1
        servers_info.append({"name": srv["name"], "status": "added", "owned": srv["owned"]})

    await db.flush()
    return {"added": added, "total": len(discovered), "servers": servers_info}


@router.delete("/servers/{server_id}")
async def delete_server(server_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    await db.delete(server)
    await db.flush()
    return {"status": "ok"}


@router.post("/servers/{server_id}/test")
async def test_server(server_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await plex_service.test_connection(server.url, server.token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verbindung fehlgeschlagen: {e}")


# --- Libraries ---


@router.get("/servers/{server_id}/libraries")
async def get_libraries(server_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await plex_service.get_libraries(server.url, server.token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/servers/{server_id}/libraries/{library_id}/items")
async def get_library_items(
    server_id: int,
    library_id: str,
    start: int = Query(0),
    size: int = Query(50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await plex_service.get_library_items(server.url, server.token, library_id, start, size)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Sessions / Now Playing ---


@router.get("/servers/{server_id}/sessions")
async def get_sessions(server_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await plex_service.get_sessions(server.url, server.token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- On Deck ---


@router.get("/servers/{server_id}/ondeck")
async def get_on_deck(server_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await plex_service.get_on_deck(server.url, server.token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- History ---


@router.get("/servers/{server_id}/history")
async def get_history(server_id: int, start: int = Query(0), size: int = Query(50), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await plex_service.get_history(server.url, server.token, start, size)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Status Check (for MovieDetailModal) ---


# Cache discovered servers per user (5 min TTL)
import time as _time
_server_cache: dict[int, dict] = {}  # user_id -> {"servers": [...], "expires": timestamp}


async def _get_user_servers(user: User, db) -> list[dict]:
    """Get user's Plex servers with caching."""
    cached = _server_cache.get(user.id)
    if cached and cached["expires"] > _time.time():
        return cached["servers"]

    if user.plex_token:
        try:
            servers = await plex_service.discover_servers(user.plex_token)
            _server_cache[user.id] = {"servers": servers, "expires": _time.time() + 300}
            return servers
        except Exception:
            pass

    # Fallback to global
    result = await db.execute(select(PlexServer).where(PlexServer.enabled == True))
    servers = [{"name": s.name, "url": s.url, "token": s.token} for s in result.scalars().all()]
    return servers


@router.get("/status/{tmdb_id}")
async def plex_status(tmdb_id: int, media_type: str = Query("movie"), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Check if a movie/show exists on any of the user's Plex servers."""
    found_servers = []
    user_servers = await _get_user_servers(user, db)

    for srv in user_servers:
        try:
            token = srv.get("token", user.plex_token)
            item = await plex_service.find_by_guid(srv["url"], token, tmdb_id, media_type)
            if not item:
                continue
            found_servers.append({
                "server_name": srv["name"],
                "ratingKey": item.get("ratingKey"),
                "title": item.get("title"),
                "year": item.get("year"),
                "videoResolution": item.get("videoResolution"),
                "videoCodec": item.get("videoCodec"),
                "audioCodec": item.get("audioCodec"),
                "audioChannels": item.get("audioChannels"),
                "fileSize": item.get("fileSize"),
                "viewCount": item.get("viewCount", 0),
                "lastViewedAt": item.get("lastViewedAt"),
            })
        except Exception:
            continue

    return {"found": len(found_servers) > 0, "servers": found_servers}


# --- Watchlist → Plex sync (mark watched/unwatched) ---


@router.post("/servers/{server_id}/scrobble/{rating_key}")
async def scrobble(server_id: int, rating_key: str, media_type: str = Query("movie"), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Mark item as watched on Plex."""
    server = await _get_server(server_id, db)
    try:
        await plex_service.mark_watched(server.url, server.token, rating_key, media_type)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/servers/{server_id}/unscrobble/{rating_key}")
async def unscrobble(server_id: int, rating_key: str, media_type: str = Query("movie"), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Mark item as unwatched on Plex."""
    server = await _get_server(server_id, db)
    try:
        await plex_service.mark_unwatched(server.url, server.token, rating_key, media_type)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Plex → Watchlist sync (manual + auto) ---


async def _extract_tmdb_id(url: str, token: str, rating_key: str) -> int | None:
    """Get TMDB ID from Plex metadata."""
    try:
        detail = await plex_service.get_metadata(url, token, rating_key)
        for g in detail.get("guids", []):
            gid = g.get("id", "")
            if gid.startswith("tmdb://"):
                return int(gid.replace("tmdb://", ""))
    except Exception:
        pass
    return None


async def _sync_tv_show(url: str, token: str, rating_key: str, tmdb_id: int, title: str, year, db, default_wl, all_wl_ids=None) -> dict:
    """Sync a single TV show — check each episode individually."""
    try:
        from ..services.plex import _request
        # Get seasons
        seasons_data = await _request(url, token, f"/library/metadata/{rating_key}/children")
        seasons = seasons_data.get("MediaContainer", {}).get("Metadata", [])

        watch_progress = {}
        total_episodes = 0
        watched_episodes = 0

        for season in seasons:
            season_num = season.get("index", 0)
            if season_num == 0:
                continue  # Skip specials

            # Get episodes
            try:
                eps_data = await _request(url, token, f"/library/metadata/{season['ratingKey']}/children")
                episodes = eps_data.get("MediaContainer", {}).get("Metadata", [])
            except Exception:
                continue

            watched_in_season = []
            for ep in episodes:
                total_episodes += 1
                if ep.get("viewCount", 0) > 0:
                    watched_episodes += 1
                    watched_in_season.append(ep.get("index", 0))

            if watched_in_season:
                watch_progress[str(season_num)] = sorted(watched_in_season)

        if watched_episodes == 0:
            return {"action": "skip"}

        # Determine status
        is_complete = watched_episodes >= total_episodes and total_episodes > 0
        status = "watched" if is_complete else "watching"

        # Find or create in watchlist
        search_wl_ids = all_wl_ids or [default_wl.id]
        existing = await db.execute(select(Movie).where(Movie.watchlist_id.in_(search_wl_ids), Movie.tmdb_id == tmdb_id))
        movie = existing.scalars().first()

        if movie:
            # Merge watch progress
            old_progress = movie.watch_progress or {}
            for season, eps in watch_progress.items():
                old_eps = set(old_progress.get(season, []))
                old_eps.update(eps)
                old_progress[season] = sorted(list(old_eps))
            movie.watch_progress = old_progress
            # Always update status based on actual progress
            if movie.status != "dropped":
                movie.status = status
            return {"action": "updated"}
        else:
            db.add(Movie(
                watchlist_id=default_wl.id, title=title,
                year=str(year) if year else None,
                tmdb_id=tmdb_id, media_type="tv",
                status=status, watch_progress=watch_progress,
            ))
            return {"action": "added"}
    except Exception as e:
        logger.error(f"TV sync failed for {title}: {e}")
        return {"action": "error"}


# Store sync status per user
_sync_status: dict[int, dict] = {}


async def _run_full_plex_sync(user_id: int):
    """Background: full Plex → Watchlist sync using user's own Plex token."""
    _sync_status[user_id] = {"running": True, "added": 0, "updated": 0, "total_scanned": 0, "errors": []}
    try:
        async with async_session() as db:
            # Get user's Plex token
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()

            # Discover servers from user's token, fallback to global
            if user and user.plex_token:
                try:
                    discovered = await plex_service.discover_servers(user.plex_token)
                    servers = [{"name": s["name"], "url": s["url"], "token": s.get("token", user.plex_token)} for s in discovered]
                except Exception:
                    servers = []
            else:
                result = await db.execute(select(PlexServer).where(PlexServer.enabled == True))
                servers = [{"name": s.name, "url": s.url, "token": s.token} for s in result.scalars().all()]

            wl_result = await db.execute(select(Watchlist).where(Watchlist.owner_id == user_id, Watchlist.is_default == True))
            default_wl = wl_result.scalar_one_or_none()
            if not default_wl:
                _sync_status[user_id] = {"running": False, "error": "Keine Standard-Watchlist"}
                return

            # Get ALL user's watchlist IDs for searching
            all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user_id))).scalars().all()
            all_wl_ids = [w.id for w in all_wls]

            added = 0
            updated = 0
            total_scanned = 0
            errors = []

            for srv in servers:
                try:
                    libraries = await plex_service.get_libraries(srv["url"], srv["token"])

                    for lib in libraries:
                        if lib["type"] not in ("movie", "show"):
                            continue

                        page = 0
                        page_size = 100

                        while True:
                            try:
                                data = await plex_service.get_library_items(srv["url"], srv["token"], lib["id"], start=page, size=page_size)
                            except Exception:
                                break

                            items = data.get("items", [])
                            if not items:
                                break

                            for item in items:
                                total_scanned += 1
                                rating_key = item.get("ratingKey")
                                if not rating_key:
                                    continue

                                tmdb_id = await _extract_tmdb_id(srv["url"], srv["token"], rating_key)
                                if not tmdb_id:
                                    continue

                                if lib["type"] == "movie":
                                    if item.get("viewCount", 0) == 0:
                                        continue
                                    existing = await db.execute(select(Movie).where(Movie.watchlist_id.in_(all_wl_ids), Movie.tmdb_id == tmdb_id))
                                    movie = existing.scalars().first()
                                    if movie:
                                        if movie.status not in ("watched", "dropped"):
                                            movie.status = "watched"
                                            updated += 1
                                    else:
                                        db.add(Movie(watchlist_id=default_wl.id, title=item.get("title", "Unknown"), year=str(item.get("year", "")) if item.get("year") else None, tmdb_id=tmdb_id, media_type="movie", status="watched"))
                                        added += 1
                                else:
                                    result_tv = await _sync_tv_show(srv["url"], srv["token"], rating_key, tmdb_id, item.get("title", "Unknown"), item.get("year"), db, default_wl, all_wl_ids)
                                    if result_tv["action"] == "added":
                                        added += 1
                                    elif result_tv["action"] == "updated":
                                        updated += 1

                                # Update live status + commit in batches
                                _sync_status[user_id] = {"running": True, "added": added, "updated": updated, "total_scanned": total_scanned, "errors": errors}
                                if total_scanned % 20 == 0:
                                    await db.commit()

                            page += page_size
                            if len(items) < page_size:
                                break

                except Exception as e:
                    errors.append(f"{srv['name']}: {str(e)}")
                    logger.error(f"Plex sync failed for {srv['name']}: {e}")

            await db.commit()
            _sync_status[user_id] = {"running": False, "added": added, "updated": updated, "total_scanned": total_scanned, "errors": errors}
            logger.info(f"Plex full sync done: {added} added, {updated} updated, {total_scanned} scanned")
            from ..services.sync_log import log_sync
            await log_sync(user_id, "plex", "import", added, updated, len(errors), f"{total_scanned} gescannt" + (f", Fehler: {', '.join(errors)}" if errors else ""))
    except Exception as e:
        logger.error(f"Plex full sync failed: {e}")
        _sync_status[user_id] = {"running": False, "error": str(e)}
        from ..services.sync_log import log_sync
        await log_sync(user_id, "plex", "import", errors=1, details=str(e))


@router.post("/sync")
async def sync_plex_to_watchlist(background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    """Start full Plex sync in background."""
    if _sync_status.get(user.id, {}).get("running"):
        return {"status": "already_running", **_sync_status[user.id]}
    background_tasks.add_task(_run_full_plex_sync, user.id)
    return {"status": "started"}


@router.get("/sync/status")
async def sync_status(user: User = Depends(get_current_user)):
    """Check sync progress."""
    return _sync_status.get(user.id, {"running": False})


@router.post("/sync/watchlist")
async def sync_watchlist_to_plex(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Push all 'watchlist'/'planned' items to Plex Watchlist, remove 'watched' items."""
    if not user.plex_token:
        return {"error": "Kein Plex-Token"}

    # Get all movies in user's watchlists
    wl_result = await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))
    watchlists = wl_result.scalars().all()
    wl_ids = [wl.id for wl in watchlists]

    if not wl_ids:
        return {"error": "Keine Watchlists"}

    movies_result = await db.execute(select(Movie).where(Movie.watchlist_id.in_(wl_ids), Movie.tmdb_id != None))
    movies = movies_result.scalars().all()

    # Get current Plex Watchlist
    try:
        plex_wl_items = await plex_service.get_plex_watchlist(user.plex_token)
        plex_wl_titles = {i.get("title", "").lower() for i in plex_wl_items}
    except Exception:
        plex_wl_items = []
        plex_wl_titles = set()

    added = 0
    removed = 0
    errors = 0

    for movie in movies:
        try:
            if movie.status in ("watchlist", "planned", "watching"):
                # Should be on Plex Watchlist
                if movie.title.lower() not in plex_wl_titles:
                    year_int = int(movie.year) if movie.year else None
                    key = await plex_service.find_on_plex_discover(user.plex_token, movie.title, movie.media_type or "movie", year_int)
                    if key:
                        await plex_service.add_to_plex_watchlist(user.plex_token, key)
                        added += 1
            elif movie.status == "watched":
                # Should NOT be on Plex Watchlist
                if movie.title.lower() in plex_wl_titles:
                    year_int = int(movie.year) if movie.year else None
                    key = await plex_service.find_on_plex_discover(user.plex_token, movie.title, movie.media_type or "movie", year_int)
                    if key:
                        await plex_service.remove_from_plex_watchlist(user.plex_token, key)
                        removed += 1
        except Exception:
            errors += 1

    return {"added": added, "removed": removed, "errors": errors, "total_checked": len(movies)}
