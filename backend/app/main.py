import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .auth import hash_password
from .config import get_settings
from .database import Base, async_session, engine
from .models import User, Watchlist
from .routers import admin, auth, friends, groups, jellyfin, matches, mcp, mcp_oauth, media, plex, radarr, sonarr, sync_overview, tautulli, watchlist
from .services.tautulli import sync_all_connected_users

settings = get_settings()
logger = logging.getLogger(__name__)

TAUTULLI_SYNC_INTERVAL = 30 * 60  # 30 minutes


async def _check_setup():
    """Check if this is a fresh install (no users)."""
    async with async_session() as db:
        result = await db.execute(select(func.count()).select_from(User))
        count = result.scalar()
        if count == 0:
            logger.info("Fresh install — first Plex login will become admin")


async def _tautulli_sync_loop():
    """Background loop that syncs Tautulli history for all connected users."""
    while True:
        await asyncio.sleep(TAUTULLI_SYNC_INTERVAL)
        try:
            async with async_session() as db:
                result = await sync_all_connected_users(db)
                await db.commit()
                if "error" not in result:
                    logger.info(f"Tautulli auto-sync completed: {result}")
        except Exception as e:
            logger.error(f"Tautulli auto-sync failed: {e}")


PLEX_SYNC_INTERVAL = 5 * 60  # 5 minutes


async def _plex_sync_loop():
    """Background loop that syncs Plex watch status to watchlist + forwards to Jellyfin."""
    from sqlalchemy import select
    from .models import JellyfinServer, Movie, PlexServer, Watchlist
    from .services import jellyfin as jf_svc, plex as plex_svc

    while True:
        await asyncio.sleep(PLEX_SYNC_INTERVAL)
        try:
            async with async_session() as db:
                result = await db.execute(select(PlexServer).where(PlexServer.enabled == True))
                servers = result.scalars().all()
                if not servers:
                    continue

                synced_tmdb_ids = []  # Track what changed for cross-sync
                for srv in servers:
                    try:
                        recent = await plex_svc.get_watch_history_recent(srv.url, srv.token, minutes=8)
                        for item in recent:
                            tmdb_id = None
                            for guid in item.get("guids", []):
                                if isinstance(guid, str) and guid.startswith("tmdb://"):
                                    tmdb_id = int(guid.replace("tmdb://", ""))
                                    break
                            if not tmdb_id:
                                continue

                            result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id, Movie.status != "watched"))
                            movies = result.scalars().all()
                            for movie in movies:
                                movie.status = "watched"
                                synced_tmdb_ids.append((tmdb_id, movie.media_type, movie.watchlist_id))

                    except Exception as e:
                        logger.error(f"Plex sync failed for server {srv.name}: {e}")

                if synced_tmdb_ids:
                    await db.commit()
                    logger.info(f"Plex sync: updated {len(synced_tmdb_ids)} to watched")

                    # Cross-sync: forward to Jellyfin
                    jf_servers = (await db.execute(select(JellyfinServer).where(JellyfinServer.enabled == True))).scalars().all()
                    for jf_srv in jf_servers:
                        for tmdb_id, media_type, _ in synced_tmdb_ids:
                            try:
                                item = await jf_svc.find_by_tmdb(jf_srv.url, jf_srv.token, jf_srv.jellyfin_user_id, tmdb_id, media_type or "tv")
                                if item and not item.get("played"):
                                    await jf_svc.mark_watched(jf_srv.url, jf_srv.token, jf_srv.jellyfin_user_id, item["id"])
                            except Exception:
                                pass
                    if jf_servers:
                        logger.info(f"Cross-sync: forwarded {len(synced_tmdb_ids)} to Jellyfin")
        except Exception as e:
            logger.error(f"Plex sync loop failed: {e}")


PLEX_DISCOVER_INTERVAL = 60 * 60  # 1 hour


async def _plex_discover_loop():
    """Background loop that auto-discovers new Plex servers."""
    from sqlalchemy import select
    from .models import PlexServer, User
    from .services import plex as plex_svc

    while True:
        await asyncio.sleep(PLEX_DISCOVER_INTERVAL)
        try:
            async with async_session() as db:
                # Find a user with plex token
                result = await db.execute(select(User).where(User.plex_token != None).limit(1))
                user = result.scalar_one_or_none()
                if not user:
                    continue

                discovered = await plex_svc.discover_servers(user.plex_token)
                existing = {s.machine_id: s for s in (await db.execute(select(PlexServer))).scalars().all() if s.machine_id}

                import re
                ip_pattern = re.compile(r'https?://\d+\.\d+\.\d+\.\d+')

                added = 0
                for srv in discovered:
                    mid = srv["machine_id"]
                    if mid in existing:
                        new_url = srv["url"].rstrip("/")
                        if existing[mid].url != new_url and ip_pattern.match(existing[mid].url):
                            existing[mid].url = new_url
                        if srv.get("token"):
                            existing[mid].token = srv["token"]
                        continue
                    db.add(PlexServer(name=srv["name"], url=srv["url"].rstrip("/"), token=srv.get("token", user.plex_token), machine_id=mid, enabled=True))
                    added += 1

                if added > 0:
                    await db.commit()
                    logger.info(f"Plex auto-discover: added {added} new servers")
        except Exception as e:
            logger.error(f"Plex discover loop failed: {e}")


JELLYFIN_SYNC_INTERVAL = 5 * 60  # 5 minutes


async def _jellyfin_sync_loop():
    """Background loop that syncs Jellyfin watch history + forwards to Plex."""
    from .models import JellyfinServer, Movie, User, Watchlist as WL
    from .services import jellyfin as jf_svc, plex as plex_svc

    while True:
        await asyncio.sleep(JELLYFIN_SYNC_INTERVAL)
        try:
            async with async_session() as db:
                servers = (await db.execute(select(JellyfinServer).where(JellyfinServer.enabled == True))).scalars().all()
                if not servers:
                    continue

                for srv in servers:
                    try:
                        shows = await jf_svc.get_watched_episodes(srv.url, srv.token, srv.jellyfin_user_id)
                        movies_watched = await jf_svc.get_watched_movies(srv.url, srv.token, srv.jellyfin_user_id)

                        all_wls = (await db.execute(select(WL).where(WL.owner_id == srv.user_id))).scalars().all()
                        all_wl_ids = [w.id for w in all_wls]
                        default_wl = next((w for w in all_wls if w.is_default), all_wls[0] if all_wls else None)
                        if not default_wl:
                            continue

                        synced = 0
                        synced_tmdb_ids = []

                        for m in movies_watched:
                            existing = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(all_wl_ids), Movie.tmdb_id == m["tmdb_id"]))).scalars().first()
                            if existing:
                                if existing.status not in ("watched", "dropped"):
                                    existing.status = "watched"
                                    synced += 1
                                    synced_tmdb_ids.append((m["tmdb_id"], "movie"))
                            else:
                                db.add(Movie(watchlist_id=default_wl.id, title=m["name"], year=str(m.get("year", "")), tmdb_id=m["tmdb_id"], media_type="movie", status="watched"))
                                synced += 1
                                synced_tmdb_ids.append((m["tmdb_id"], "movie"))

                        for show in shows:
                            existing = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(all_wl_ids), Movie.tmdb_id == show["tmdb_id"]))).scalars().first()
                            progress = show["episodes"]
                            total_watched = sum(len(eps) for eps in progress.values())
                            status = "watching" if total_watched > 0 else "watchlist"

                            if existing:
                                old_p = existing.watch_progress or {}
                                changed = False
                                for s, eps in progress.items():
                                    old_eps = set(old_p.get(s, []))
                                    new_eps = set(eps)
                                    if not new_eps.issubset(old_eps):
                                        old_eps.update(new_eps)
                                        old_p[s] = sorted(list(old_eps))
                                        changed = True
                                if changed:
                                    existing.watch_progress = old_p
                                    if existing.status not in ("watched", "dropped"):
                                        existing.status = status
                                    synced += 1
                            else:
                                db.add(Movie(watchlist_id=default_wl.id, title=show["name"], tmdb_id=show["tmdb_id"], media_type="tv", status=status, watch_progress=progress))
                                synced += 1

                        if synced > 0:
                            await db.commit()
                            logger.info(f"Jellyfin auto-sync: {synced} changes for user {srv.user_id}")

                            # Cross-sync: forward new watched to Plex
                            user = (await db.execute(select(User).where(User.id == srv.user_id))).scalar_one_or_none()
                            if user and user.plex_token and synced_tmdb_ids:
                                try:
                                    plex_servers = await plex_svc.discover_servers(user.plex_token)
                                    for ps in plex_servers:
                                        for tmdb_id, media_type in synced_tmdb_ids:
                                            try:
                                                token = ps.get("token", user.plex_token)
                                                item = await plex_svc.find_by_guid(ps["url"], token, tmdb_id, media_type)
                                                if item:
                                                    plex_type = "show" if media_type == "tv" else "movie"
                                                    await plex_svc.mark_watched(ps["url"], token, item["ratingKey"], plex_type)
                                            except Exception:
                                                pass
                                    logger.info(f"Cross-sync: forwarded {len(synced_tmdb_ids)} from Jellyfin to Plex")
                                except Exception:
                                    pass

                    except Exception as e:
                        logger.error(f"Jellyfin auto-sync failed for {srv.name}: {e}")
        except Exception as e:
            logger.error(f"Jellyfin sync loop failed: {e}")


async def _nightly_full_sync():
    """Run full Plex + Jellyfin sync once at 3 AM."""
    from .routers.plex import _run_full_plex_sync
    from .routers.jellyfin import _run_jellyfin_sync

    while True:
        # Calculate seconds until 3:00 AM
        import datetime
        now = datetime.datetime.now()
        target = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if target <= now:
            target += datetime.timedelta(days=1)
        wait_seconds = (target - now).total_seconds()
        logger.info(f"Nightly sync scheduled in {wait_seconds/3600:.1f} hours")
        await asyncio.sleep(wait_seconds)

        try:
            async with async_session() as db:
                users = (await db.execute(select(User).where(User.plex_token != None))).scalars().all()

            for user in users:
                try:
                    logger.info(f"Nightly full sync starting for {user.username}")
                    await _run_full_plex_sync(user.id)
                    await _run_jellyfin_sync(user.id)
                    logger.info(f"Nightly full sync completed for {user.username}")
                except Exception as e:
                    logger.error(f"Nightly sync failed for {user.username}: {e}")
        except Exception as e:
            logger.error(f"Nightly sync failed: {e}")


async def _run_migrations():
    """Add columns that create_all won't add to existing tables."""
    from sqlalchemy import text

    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_installer BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS plex_avatar VARCHAR(500)",
        "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS jellyfin_id VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS jellyfin_username VARCHAR(100)",
        "ALTER TABLE jellyfin_servers ADD COLUMN IF NOT EXISTS jf_username VARCHAR(100)",
        "ALTER TABLE jellyfin_servers ADD COLUMN IF NOT EXISTS jf_password VARCHAR(255)",
        "ALTER TABLE tautulli_servers ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE",
        "ALTER TABLE sonarr_servers ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE",
        "ALTER TABLE radarr_servers ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE",
        "ALTER TABLE plex_servers ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE",
    ]
    async with engine.begin() as conn:
        for sql in migrations:
            await conn.execute(text(sql))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _run_migrations()
    await _check_setup()

    # Start background sync loops
    sync_task = asyncio.create_task(_tautulli_sync_loop())
    plex_sync_task = asyncio.create_task(_plex_sync_loop())
    plex_discover_task = asyncio.create_task(_plex_discover_loop())
    jellyfin_sync_task = asyncio.create_task(_jellyfin_sync_loop())
    nightly_task = asyncio.create_task(_nightly_full_sync())
    yield
    sync_task.cancel()
    plex_sync_task.cancel()
    plex_discover_task.cancel()
    jellyfin_sync_task.cancel()
    nightly_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass
    try:
        await plex_sync_task
    except asyncio.CancelledError:
        pass
    try:
        await plex_discover_task
    except asyncio.CancelledError:
        pass
    try:
        await jellyfin_sync_task
    except asyncio.CancelledError:
        pass
    try:
        await nightly_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(
    title="Watchlist API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(watchlist.router)
app.include_router(friends.router)
app.include_router(matches.router)
app.include_router(groups.router)
app.include_router(media.router)
app.include_router(tautulli.router)
app.include_router(sonarr.router)
app.include_router(radarr.router)
app.include_router(plex.router)
app.include_router(jellyfin.router)
app.include_router(sync_overview.router)
app.include_router(mcp.router)
app.include_router(mcp_oauth.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
