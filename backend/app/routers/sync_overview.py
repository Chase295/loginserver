"""Sync Overview — shows status of all integrations for the current user."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import async_session, get_db
from ..models import (
    JellyfinServer, Movie, PlexServer, RadarrServer,
    SonarrServer, SyncLog, TautulliServer, User, Watchlist,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sync", tags=["sync"])

_full_sync_status: dict[int, dict] = {}


async def _run_full_sync(user_id: int):
    """Background: run Plex + Jellyfin + Tautulli sync sequentially."""
    from ..services.sync_log import log_sync

    _full_sync_status[user_id] = {"running": True, "step": "plex", "results": []}
    try:
        # 1. Plex (has its own logging)
        _full_sync_status[user_id]["step"] = "plex"
        try:
            from ..routers.plex import _run_full_plex_sync
            await _run_full_plex_sync(user_id)
            _full_sync_status[user_id]["results"].append("Plex: OK")
        except Exception as e:
            _full_sync_status[user_id]["results"].append(f"Plex: Fehler — {e}")
            await log_sync(user_id, "plex", "import", errors=1, details=f"Voller Sync fehlgeschlagen: {e}")

        # 2. Jellyfin (has its own logging)
        _full_sync_status[user_id]["step"] = "jellyfin"
        try:
            from ..routers.jellyfin import _run_jellyfin_sync
            await _run_jellyfin_sync(user_id)
            _full_sync_status[user_id]["results"].append("Jellyfin: OK")
        except Exception as e:
            _full_sync_status[user_id]["results"].append(f"Jellyfin: Fehler — {e}")
            await log_sync(user_id, "jellyfin", "import", errors=1, details=f"Voller Sync fehlgeschlagen: {e}")

        # 3. Tautulli
        _full_sync_status[user_id]["step"] = "tautulli"
        try:
            async with async_session() as db:
                from ..models import UserPlexConnection
                conn = (await db.execute(select(UserPlexConnection).where(UserPlexConnection.user_id == user_id))).scalar_one_or_none()
                if conn:
                    srv = (await db.execute(select(TautulliServer).where(TautulliServer.id == conn.server_id, TautulliServer.enabled == True))).scalar_one_or_none()
                    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
                    if srv:
                        from ..services.tautulli import sync_user_history
                        result = await sync_user_history(user, conn, srv, db)
                        await db.commit()
                        a, u = result.get('added', 0), result.get('updated', 0)
                        _full_sync_status[user_id]["results"].append(f"Tautulli: +{a} ~{u}")
                        await log_sync(user_id, "tautulli", "import", a, u, details=f"Voller Sync")
                    else:
                        _full_sync_status[user_id]["results"].append("Tautulli: übersprungen (kein aktiver Server)")
                else:
                    _full_sync_status[user_id]["results"].append("Tautulli: übersprungen (keine Verbindung)")
        except Exception as e:
            _full_sync_status[user_id]["results"].append(f"Tautulli: Fehler — {e}")
            await log_sync(user_id, "tautulli", "import", errors=1, details=str(e))

        _full_sync_status[user_id] = {"running": False, "step": "done", "results": _full_sync_status[user_id]["results"]}
        logger.info(f"Full sync done for user {user_id}: {_full_sync_status[user_id]['results']}")
    except Exception as e:
        _full_sync_status[user_id] = {"running": False, "step": "error", "results": [str(e)]}
        await log_sync(user_id, "full-sync", "import", errors=1, details=str(e))


@router.post("/full")
async def start_full_sync(user: User = Depends(get_current_user)):
    """Start full Plex + Jellyfin + Tautulli sync in background."""
    if _full_sync_status.get(user.id, {}).get("running"):
        return {"status": "already_running", **_full_sync_status[user.id]}
    import asyncio
    asyncio.ensure_future(_run_full_sync(user.id))
    return {"status": "started"}


@router.get("/full/status")
async def full_sync_status(user: User = Depends(get_current_user)):
    return _full_sync_status.get(user.id, {"running": False, "step": "idle", "results": []})


@router.get("/overview")
async def sync_overview(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Complete sync overview for the current user."""

    # --- Watchlist Stats ---
    all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))).scalars().all()
    wl_ids = [w.id for w in all_wls]

    total = 0
    movies_count = 0
    series_count = 0
    watched = 0
    watching = 0
    episodes_watched = 0
    by_status = {}

    if wl_ids:
        all_movies = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(wl_ids)))).scalars().all()
        total = len(all_movies)
        for m in all_movies:
            if m.media_type == "movie":
                movies_count += 1
            else:
                series_count += 1
            by_status[m.status] = by_status.get(m.status, 0) + 1
            if m.status == "watched":
                watched += 1
            elif m.status == "watching":
                watching += 1
            if m.watch_progress:
                for eps in m.watch_progress.values():
                    if isinstance(eps, list):
                        episodes_watched += len(eps)

    # --- Plex (from DB, no live check) ---
    plex_info = {"connected": bool(user.plex_token), "servers": []}
    plex_servers = (await db.execute(select(PlexServer))).scalars().all()
    for s in plex_servers:
        plex_info["servers"].append({"name": s.name, "url": s.url, "enabled": s.enabled})
    if not plex_servers and user.plex_token:
        plex_info["servers"] = [{"name": "Via Plex-Token", "url": "", "enabled": True}]

    # --- Jellyfin (from DB, no live check) ---
    jf_info = {"connected": False, "servers": []}
    jf_servers = (await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user.id))).scalars().all()
    if jf_servers:
        jf_info["connected"] = True
        for srv in jf_servers:
            jf_info["servers"].append({"name": srv.name, "url": srv.url, "enabled": srv.enabled})

    # --- Sonarr ---
    sonarr_info = {"connected": False, "servers": []}
    sonarr_servers = (await db.execute(select(SonarrServer))).scalars().all()
    if sonarr_servers:
        sonarr_info["connected"] = True
        sonarr_info["servers"] = [{"name": s.name, "enabled": s.enabled} for s in sonarr_servers]

    # --- Radarr ---
    radarr_info = {"connected": False, "servers": []}
    radarr_servers = (await db.execute(select(RadarrServer))).scalars().all()
    if radarr_servers:
        radarr_info["connected"] = True
        radarr_info["servers"] = [{"name": s.name, "enabled": s.enabled} for s in radarr_servers]

    # --- Tautulli ---
    tautulli_info = {"connected": False, "servers": []}
    tautulli_servers = (await db.execute(select(TautulliServer))).scalars().all()
    if tautulli_servers:
        tautulli_info["connected"] = True
        tautulli_info["servers"] = [{"name": s.name, "enabled": s.enabled} for s in tautulli_servers]

    # --- Sync Schedule ---
    schedule = [
        {"name": "Plex Watch-History", "interval": "10 Min", "type": "auto", "active": plex_info["connected"]},
        {"name": "Jellyfin Watch-History", "interval": "10 Min", "type": "auto", "active": jf_info["connected"]},
        {"name": "Plex Server Discovery", "interval": "1 Stunde", "type": "auto", "active": plex_info["connected"]},
        {"name": "Tautulli Sync", "interval": "30 Min", "type": "auto", "active": tautulli_info["connected"]},
        {"name": "Voller Plex+Jellyfin+Tautulli Sync", "interval": "Täglich 3:00", "type": "nightly", "active": True},
        {"name": "Status → Plex/Jellyfin", "interval": "Sofort", "type": "realtime", "active": True},
        {"name": "Episoden → Plex/Jellyfin", "interval": "Sofort", "type": "realtime", "active": True},
        {"name": "Watchlist → Plex Merkliste", "interval": "Sofort", "type": "realtime", "active": plex_info["connected"]},
    ]

    # --- Recent Sync Logs ---
    logs_result = await db.execute(
        select(SyncLog).where(SyncLog.user_id == user.id).order_by(SyncLog.created_at.desc()).limit(20)
    )
    recent_logs = [
        {
            "source": l.source, "direction": l.direction,
            "added": l.added, "updated": l.updated, "errors": l.errors,
            "details": l.details, "created_at": str(l.created_at),
        }
        for l in logs_result.scalars().all()
    ]

    return {
        "watchlist": {
            "total": total, "movies": movies_count, "series": series_count,
            "watched": watched, "watching": watching, "episodes_watched": episodes_watched,
            "by_status": by_status,
        },
        "plex": plex_info,
        "jellyfin": jf_info,
        "sonarr": sonarr_info,
        "radarr": radarr_info,
        "tautulli": tautulli_info,
        "schedule": schedule,
        "recent_logs": recent_logs,
        "user": {
            "username": user.username,
            "auth_provider": getattr(user, "auth_provider", "local"),
            "plex_username": user.plex_username,
        },
    }
