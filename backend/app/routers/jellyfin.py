import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import async_session, get_db
from ..models import JellyfinServer, Movie, User, Watchlist
from ..services import jellyfin as jf_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/jellyfin", tags=["jellyfin"])


# --- Server CRUD (per user) ---


@router.get("/servers")
async def list_servers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user.id))
    return [{"id": s.id, "name": s.name, "url": s.url, "enabled": s.enabled, "created_at": str(s.created_at)} for s in result.scalars().all()]


@router.post("/servers")
async def add_server(data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    url = data["url"].rstrip("/")
    username = data["username"]
    password = data["password"]

    try:
        auth = await jf_service.authenticate(url, username, password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verbindung fehlgeschlagen: {e}")

    # Test connection
    try:
        info = await jf_service.test_connection(url, auth["token"], auth["user_id"])
    except Exception:
        info = {"name": "Jellyfin"}

    server = JellyfinServer(
        user_id=user.id,
        name=data.get("name") or info.get("name", "Jellyfin"),
        url=url,
        token=auth["token"],
        jellyfin_user_id=auth["user_id"],
        jf_username=username,
        jf_password=password,
    )
    db.add(server)
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url, "version": info.get("version")}


@router.delete("/servers/{server_id}")
async def delete_server(server_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JellyfinServer).where(JellyfinServer.id == server_id, JellyfinServer.user_id == user.id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404)
    await db.delete(server)
    await db.flush()
    return {"status": "ok"}


@router.post("/servers/{server_id}/test")
async def test_server(server_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JellyfinServer).where(JellyfinServer.id == server_id, JellyfinServer.user_id == user.id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404)
    try:
        return await jf_service.test_connection(server.url, server.token, server.jellyfin_user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Status Check ---


@router.get("/status/{tmdb_id}")
async def jellyfin_status(tmdb_id: int, media_type: str = Query("movie"), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user.id, JellyfinServer.enabled == True))
    servers = result.scalars().all()
    found = []
    for srv in servers:
        try:
            item = await jf_service.find_by_tmdb(srv.url, srv.token, srv.jellyfin_user_id, tmdb_id, media_type)
            if item:
                entry = {"server_name": srv.name, **item}
                # Fetch MediaStreams for audio/subtitle languages
                try:
                    item_detail = await jf_service._request(
                        srv.url, srv.token, "GET",
                        f"/Users/{srv.jellyfin_user_id}/Items/{item['id']}",
                        params={"Fields": "MediaStreams"},
                    )
                    audio_langs: list[str] = []
                    sub_langs: list[str] = []
                    for stream in item_detail.get("MediaStreams", []):
                        lang = stream.get("Language") or stream.get("DisplayLanguage")
                        if not lang or lang in ("und", "Unknown"):
                            continue
                        stype = stream.get("Type", "")
                        if stype == "Audio" and lang not in audio_langs:
                            audio_langs.append(lang)
                        elif stype == "Subtitle" and lang not in sub_langs:
                            sub_langs.append(lang)
                    entry["audioLanguages"] = audio_langs
                    entry["subtitleLanguages"] = sub_langs
                except Exception:
                    entry["audioLanguages"] = []
                    entry["subtitleLanguages"] = []
                found.append(entry)
        except Exception:
            continue
    return {"found": len(found) > 0, "servers": found}


# --- Sync ---

_sync_status: dict[int, dict] = {}


async def _run_jellyfin_sync(user_id: int):
    """Full Jellyfin → Watchlist sync."""
    _sync_status[user_id] = {"running": True, "added": 0, "updated": 0, "errors": []}
    try:
        async with async_session() as db:
            servers = (await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user_id, JellyfinServer.enabled == True))).scalars().all()
            wl = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user_id, Watchlist.is_default == True))).scalar_one_or_none()
            if not wl:
                _sync_status[user_id] = {"running": False, "error": "Keine Watchlist"}
                return

            added = 0
            updated = 0
            errors = []

            for srv in servers:
                try:
                    # Movies
                    movies = await jf_service.get_watched_movies(srv.url, srv.token, srv.jellyfin_user_id)
                    # Get all user's watchlist IDs
                    all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user_id))).scalars().all()
                    all_wl_ids = [w.id for w in all_wls]

                    for m in movies:
                        existing = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(all_wl_ids), Movie.tmdb_id == m["tmdb_id"]))).scalars().first()
                        if existing:
                            if existing.status not in ("watched", "dropped"):
                                existing.status = "watched"
                                updated += 1
                        else:
                            db.add(Movie(watchlist_id=wl.id, title=m["name"], year=str(m.get("year", "")), tmdb_id=m["tmdb_id"], media_type="movie", status="watched"))
                            added += 1

                    # TV Shows
                    shows = await jf_service.get_watched_episodes(srv.url, srv.token, srv.jellyfin_user_id)
                    for show in shows:
                        existing = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(all_wl_ids), Movie.tmdb_id == show["tmdb_id"]))).scalars().first()
                        progress = show["episodes"]
                        total_watched = sum(len(eps) for eps in progress.values())
                        status = "watching" if total_watched > 0 else "watchlist"

                        if existing:
                            old_p = existing.watch_progress or {}
                            for s, eps in progress.items():
                                old_eps = set(old_p.get(s, []))
                                old_eps.update(eps)
                                old_p[s] = sorted(list(old_eps))
                            existing.watch_progress = old_p
                            if existing.status not in ("watched", "dropped"):
                                existing.status = status
                            updated += 1
                        else:
                            db.add(Movie(watchlist_id=wl.id, title=show["name"], tmdb_id=show["tmdb_id"], media_type="tv", status=status, watch_progress=progress))
                            added += 1

                    if (added + updated) % 20 == 0:
                        await db.commit()

                except Exception as e:
                    errors.append(f"{srv.name}: {str(e)}")

            await db.commit()
            _sync_status[user_id] = {"running": False, "added": added, "updated": updated, "errors": errors}
            from ..services.sync_log import log_sync
            await log_sync(user_id, "jellyfin", "import", added, updated, len(errors), f"Fehler: {', '.join(errors)}" if errors else "")
    except Exception as e:
        _sync_status[user_id] = {"running": False, "error": str(e)}
        from ..services.sync_log import log_sync
        await log_sync(user_id, "jellyfin", "import", errors=1, details=str(e))


@router.post("/sync")
async def sync(background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    if _sync_status.get(user.id, {}).get("running"):
        return {"status": "already_running"}
    background_tasks.add_task(_run_jellyfin_sync, user.id)
    return {"status": "started"}


@router.get("/sync/status")
async def sync_status(user: User = Depends(get_current_user)):
    return _sync_status.get(user.id, {"running": False})
