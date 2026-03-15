import asyncio
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import async_session, get_db
from ..models import DownloadProfile, Friend, JellyfinServer, Movie, PlexServer, RadarrServer, SonarrServer, User, Watchlist, WatchlistShare
from ..services import jellyfin as jf_service, plex as plex_service, radarr as radarr_service, sonarr as sonarr_service
from ..services.tmdb import TMDBService

logger = logging.getLogger(__name__)
from ..schemas import (
    MovieCreate,
    MovieOut,
    MovieUpdate,
    WatchlistCreate,
    WatchlistOut,
    WatchlistSettings,
    WatchlistShareCreate,
    WatchlistUpdate,
)

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


# --- Helper ---
async def get_or_create_default(user_id: int, db: AsyncSession) -> Watchlist:
    result = await db.execute(
        select(Watchlist).where(Watchlist.owner_id == user_id, Watchlist.is_default.is_(True))
    )
    wl = result.scalar_one_or_none()
    if not wl:
        wl = Watchlist(owner_id=user_id, name="Meine Watchlist", icon="🎬", is_default=True)
        db.add(wl)
        await db.flush()
    return wl


async def get_accessible_watchlist(watchlist_id: int, user_id: int, db: AsyncSession, need_edit: bool = False) -> Watchlist:
    """Get a watchlist if user owns it or has share access."""
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    if wl.owner_id == user_id:
        return wl

    share = await db.execute(
        select(WatchlistShare).where(WatchlistShare.watchlist_id == watchlist_id, WatchlistShare.user_id == user_id)
    )
    s = share.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=403, detail="No access")
    if need_edit and s.permission != "edit":
        raise HTTPException(status_code=403, detail="No edit permission")
    return wl


# --- Watchlist CRUD ---
@router.get("/lists", response_model=list[WatchlistOut])
async def get_my_watchlists(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Own watchlists
    result = await db.execute(
        select(Watchlist).where(Watchlist.owner_id == user.id).order_by(Watchlist.is_default.desc(), Watchlist.created_at)
    )
    own = result.scalars().all()

    # Shared with me
    shared_result = await db.execute(
        select(Watchlist)
        .join(WatchlistShare, WatchlistShare.watchlist_id == Watchlist.id)
        .where(WatchlistShare.user_id == user.id)
    )
    shared = shared_result.scalars().all()

    # Ensure default exists
    if not own:
        default = await get_or_create_default(user.id, db)
        own = [default]

    out = []
    for wl in list(own) + list(shared):
        count = await db.execute(select(func.count()).where(Movie.watchlist_id == wl.id))
        owner = await db.execute(select(User.username).where(User.id == wl.owner_id))

        shares = await db.execute(
            select(WatchlistShare, User).join(User, WatchlistShare.user_id == User.id).where(WatchlistShare.watchlist_id == wl.id)
        )
        shared_with = [{"user_id": s.user_id, "username": u.username, "permission": s.permission} for s, u in shares.all()]

        out.append(WatchlistOut(
            id=wl.id, name=wl.name, icon=wl.icon, owner_id=wl.owner_id,
            owner_username=owner.scalar(), visibility=wl.visibility,
            is_default=wl.is_default, movie_count=count.scalar(),
            shared_with=shared_with, created_at=wl.created_at,
        ))
    return out


@router.post("/lists", response_model=WatchlistOut, status_code=201)
async def create_watchlist(data: WatchlistCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = Watchlist(owner_id=user.id, name=data.name, icon=data.icon, visibility=data.visibility)
    db.add(wl)
    await db.flush()
    return WatchlistOut(
        id=wl.id, name=wl.name, icon=wl.icon, owner_id=wl.owner_id,
        owner_username=user.username, visibility=wl.visibility,
        is_default=False, created_at=wl.created_at,
    )


@router.put("/lists/{watchlist_id}", response_model=WatchlistOut)
async def update_watchlist(watchlist_id: int, data: WatchlistUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await get_accessible_watchlist(watchlist_id, user.id, db, need_edit=True)
    if wl.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only owner can update")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(wl, key, value)
    await db.flush()

    count = await db.execute(select(func.count()).where(Movie.watchlist_id == wl.id))
    return WatchlistOut(
        id=wl.id, name=wl.name, icon=wl.icon, owner_id=wl.owner_id,
        owner_username=user.username, visibility=wl.visibility,
        is_default=wl.is_default, movie_count=count.scalar(), created_at=wl.created_at,
    )


@router.delete("/lists/{watchlist_id}", status_code=204)
async def delete_watchlist(watchlist_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.owner_id == user.id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404)
    if wl.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default watchlist")
    await db.delete(wl)


# --- Sharing ---
@router.post("/lists/{watchlist_id}/share")
async def share_watchlist(watchlist_id: int, data: WatchlistShareCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.owner_id == user.id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404)

    target = await db.execute(select(User).where(User.username == data.username))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    existing = await db.execute(
        select(WatchlistShare).where(WatchlistShare.watchlist_id == watchlist_id, WatchlistShare.user_id == target_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already shared")

    db.add(WatchlistShare(watchlist_id=watchlist_id, user_id=target_user.id, permission=data.permission))
    return {"message": f"Shared with {data.username}"}


@router.delete("/lists/{watchlist_id}/share/{user_id}")
async def unshare_watchlist(watchlist_id: int, user_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.owner_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404)

    share = await db.execute(
        select(WatchlistShare).where(WatchlistShare.watchlist_id == watchlist_id, WatchlistShare.user_id == user_id)
    )
    s = share.scalar_one_or_none()
    if s:
        await db.delete(s)
    return {"message": "Unshared"}


def _needs_enrich(movie: Movie) -> bool:
    return bool(movie.tmdb_id and movie.media_type and (not movie.poster_url or not movie.overview or not movie.backdrop_path))


async def _auto_enrich(movies: list[Movie], db: AsyncSession):
    """Auto-enrich movies missing metadata from TMDB."""
    tmdb = TMDBService()
    for movie in movies:
        if _needs_enrich(movie):
            try:
                data = await tmdb.details(movie.media_type, movie.tmdb_id)
                if data.get("poster_path"):
                    movie.poster_url = data["poster_path"]
                if not movie.backdrop_path and data.get("backdrop_path"):
                    movie.backdrop_path = data["backdrop_path"]
                if not movie.overview and data.get("overview"):
                    movie.overview = data["overview"]
                if not movie.vote_average and data.get("vote_average"):
                    movie.vote_average = data["vote_average"]
                if not movie.genres and data.get("genres"):
                    movie.genres = [g["id"] for g in data["genres"]]
                if not movie.year:
                    date = data.get("release_date") or data.get("first_air_date") or ""
                    if date:
                        movie.year = date[:4]
            except Exception:
                pass
    await db.flush()


# --- Movies ---
@router.get("/movies", response_model=list[MovieOut])
async def get_movies(
    watchlist_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if watchlist_id:
        wl = await get_accessible_watchlist(watchlist_id, user.id, db)
        result = await db.execute(
            select(Movie).where(Movie.watchlist_id == wl.id).order_by(Movie.created_at.desc())
        )
    else:
        # All movies from all owned + shared watchlists
        own_ids = await db.execute(select(Watchlist.id).where(Watchlist.owner_id == user.id))
        shared_ids = await db.execute(
            select(WatchlistShare.watchlist_id).where(WatchlistShare.user_id == user.id)
        )
        all_ids = [r for r in own_ids.scalars().all()] + [r for r in shared_ids.scalars().all()]
        if not all_ids:
            default = await get_or_create_default(user.id, db)
            all_ids = [default.id]

        result = await db.execute(
            select(Movie).where(Movie.watchlist_id.in_(all_ids)).order_by(Movie.created_at.desc())
        )

    movies = result.scalars().all()
    to_enrich = [m for m in movies if _needs_enrich(m)]
    if to_enrich:
        await _auto_enrich(to_enrich, db)
    return movies


async def _auto_download(tmdb_id: int, media_type: str, title: str, tags: list | None):
    """Background task: check download profiles and auto-add to *arr."""
    try:
        async with async_session() as db:
            result = await db.execute(select(DownloadProfile).where(DownloadProfile.enabled == True))
            profiles = result.scalars().all()
            if not profiles:
                return

            # Determine match type
            tag_labels = [t.get("label", "").lower() if isinstance(t, dict) else str(t).lower() for t in (tags or [])]
            is_anime = "anime" in tag_labels

            if media_type == "movie":
                match_type = "movie"
            elif is_anime:
                match_type = "anime"
            else:
                match_type = "series"

            # Find matching profile
            profile = None
            for p in profiles:
                if p.match_type == match_type:
                    profile = p
                    break
            if not profile:
                return

            if profile.server_type == "radarr" and media_type == "movie":
                srv_result = await db.execute(select(RadarrServer).where(RadarrServer.id == profile.server_id))
                server = srv_result.scalar_one_or_none()
                if not server:
                    return
                # Lookup
                lookup = await radarr_service.lookup_by_tmdb(server.url, server.api_key, tmdb_id)
                if not lookup:
                    return
                movie_data = lookup[0]
                # Check if already exists
                existing = await radarr_service.get_movie_by_tmdb(server.url, server.api_key, tmdb_id)
                if existing:
                    return
                # Add
                await radarr_service.add_movie(server.url, server.api_key, {
                    "title": movie_data.get("title", title),
                    "tmdbId": movie_data.get("tmdbId"),
                    "qualityProfileId": profile.quality_profile_id,
                    "rootFolderPath": profile.root_folder_path,
                    "monitored": True,
                    "minimumAvailability": "released",
                    "addOptions": {"searchForMovie": profile.auto_search},
                    "images": movie_data.get("images", []),
                    "year": movie_data.get("year"),
                })
                logger.info(f"Auto-added movie '{title}' to Radarr server {server.name}")

            elif profile.server_type == "sonarr" and media_type == "tv":
                srv_result = await db.execute(select(SonarrServer).where(SonarrServer.id == profile.server_id))
                server = srv_result.scalar_one_or_none()
                if not server:
                    return
                # Lookup
                lookup = await sonarr_service.lookup_by_tmdb(server.url, server.api_key, tmdb_id)
                if not lookup:
                    return
                series_data = lookup[0]
                # Check if already exists
                existing = await sonarr_service.get_series_by_tmdb(server.url, server.api_key, tmdb_id)
                if existing:
                    return
                # Add
                await sonarr_service.add_series(server.url, server.api_key, {
                    "title": series_data.get("title", title),
                    "tvdbId": series_data.get("tvdbId"),
                    "qualityProfileId": profile.quality_profile_id,
                    "rootFolderPath": profile.root_folder_path,
                    "monitored": True,
                    "seasonFolder": True,
                    "addOptions": {
                        "monitor": profile.monitor_strategy or "none",
                        "searchForMissingEpisodes": profile.auto_search,
                    },
                    "images": series_data.get("images", []),
                    "seasons": series_data.get("seasons", []),
                })
                logger.info(f"Auto-added series '{title}' to Sonarr server {server.name}")

    except Exception as e:
        logger.error(f"Auto-download failed for '{title}': {e}")


@router.post("/movies", response_model=MovieOut, status_code=201)
async def add_movie(
    data: MovieCreate,
    background_tasks: BackgroundTasks,
    watchlist_id: int | None = Query(None),
    skip_auto_download: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if watchlist_id:
        wl = await get_accessible_watchlist(watchlist_id, user.id, db, need_edit=True)
    else:
        wl = await get_or_create_default(user.id, db)

    # Check for duplicate
    if data.tmdb_id:
        existing = await db.execute(
            select(Movie).where(
                Movie.watchlist_id == wl.id,
                Movie.tmdb_id == data.tmdb_id,
                Movie.media_type == data.media_type,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Movie already in watchlist")

    movie = Movie(watchlist_id=wl.id, **data.model_dump(mode="json"))
    db.add(movie)
    await db.flush()
    await db.refresh(movie)

    # Trigger auto-download in background
    if data.tmdb_id and data.media_type and not skip_auto_download:
        tags_copy = list(data.tags) if data.tags else []
        background_tasks.add_task(_auto_download, data.tmdb_id, data.media_type, data.title, tags_copy)

    # Add to Plex Watchlist
    if data.tmdb_id and data.media_type and data.status in ("watchlist", "planned") and user.plex_token:
        background_tasks.add_task(_sync_plex_watch_status, data.tmdb_id, data.media_type, data.status, data.title, data.year or "", user.id)

    return movie


async def _sync_plex_watch_status(tmdb_id: int, media_type: str, status: str, title: str = "", year: str = "", user_id: int = 0):
    """Sync watch status to Plex servers + Plex Cloud Watchlist."""
    try:
        async with async_session() as db:
            # Get user for their Plex token
            user = None
            if user_id:
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()

            plex_token = user.plex_token if user else None

            # 1. Sync watch status to Plex servers (mark watched/unwatched)
            if plex_token:
                try:
                    servers = await plex_service.discover_servers(plex_token)
                    for srv in servers:
                        try:
                            token = srv.get("token", plex_token)
                            item = await plex_service.find_by_guid(srv["url"], token, tmdb_id, media_type)
                            if not item:
                                continue
                            rating_key = item.get("ratingKey")
                            if not rating_key:
                                continue
                            plex_type = "show" if media_type == "tv" else "movie"
                            if status == "watched":
                                await plex_service.mark_watched(srv["url"], token, rating_key, plex_type)
                                logger.info(f"Marked '{item.get('title')}' as watched on {srv['name']}")
                            elif status in ("watchlist", "planned") and item.get("viewCount", 0) > 0:
                                await plex_service.mark_unwatched(srv["url"], token, rating_key, plex_type)
                        except Exception:
                            continue
                except Exception:
                    pass

            # 2. Sync Plex Cloud Watchlist
            if plex_token and title:
                try:
                    year_int = int(year) if year else None
                    discover_key = await plex_service.find_on_plex_discover(plex_token, title, media_type, year_int)
                    if discover_key:
                        if status in ("watchlist", "planned"):
                            await plex_service.add_to_plex_watchlist(plex_token, discover_key)
                            logger.info(f"Added '{title}' to Plex Watchlist")
                        elif status == "watched":
                            await plex_service.remove_from_plex_watchlist(plex_token, discover_key)
                            logger.info(f"Removed '{title}' from Plex Watchlist (watched)")
                except Exception as e:
                    logger.error(f"Plex Watchlist sync failed: {e}")

    except Exception as e:
        logger.error(f"Plex sync failed: {e}")

    # 3. Sync to Jellyfin servers
    try:
        async with async_session() as db:
            jf_servers = (await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user_id, JellyfinServer.enabled == True))).scalars().all()
            for srv in jf_servers:
                try:
                    item = await jf_service.find_by_tmdb(srv.url, srv.token, srv.jellyfin_user_id, tmdb_id, media_type)
                    if not item:
                        continue
                    if status == "watched":
                        await jf_service.mark_watched(srv.url, srv.token, srv.jellyfin_user_id, item["id"])
                        logger.info(f"Marked '{item['name']}' as watched on Jellyfin {srv.name}")
                        from ..services.sync_log import log_sync
                        await log_sync(user_id, "jellyfin", "export", updated=1, details=f"'{title}' → {status} auf {srv.name}")
                    elif status in ("watchlist", "planned"):
                        await jf_service.mark_unwatched(srv.url, srv.token, srv.jellyfin_user_id, item["id"])
                        from ..services.sync_log import log_sync
                        await log_sync(user_id, "jellyfin", "export", updated=1, details=f"'{title}' → ungesehen auf {srv.name}")
                except Exception as e:
                    logger.error(f"Jellyfin sync failed for {srv.name}: {e}")
    except Exception:
        pass

    # Log the Plex status sync
    from ..services.sync_log import log_sync
    await log_sync(user_id, "plex", "export", updated=1, details=f"'{title}' → {status}")


async def _sync_plex_episode_progress(tmdb_id: int, old_progress: dict, new_progress: dict, user_id: int):
    """Sync individual episode watch progress changes to Plex."""
    try:
        async with async_session() as db:
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
            if not user or not user.plex_token:
                return

            # Find new episodes (in new_progress but not in old_progress)
            new_episodes = {}  # {season: [ep_nums]}
            for season, eps in new_progress.items():
                old_eps = set(old_progress.get(season, []))
                new_eps = [e for e in eps if e not in old_eps]
                if new_eps:
                    new_episodes[season] = new_eps

            if not new_episodes:
                logger.warning(f"No new episodes to sync")
                return

            logger.warning(f"Syncing new episodes to Plex: {new_episodes}")

            # Find the show on Plex servers
            servers = await plex_service.discover_servers(user.plex_token)
            for srv in servers:
                try:
                    token = srv.get("token", user.plex_token)
                    item = await plex_service.find_by_guid(srv["url"], token, tmdb_id, "tv")
                    if not item:
                        continue

                    rating_key = item.get("ratingKey")
                    if not rating_key:
                        continue

                    from app.services.plex import _request, _scrobble

                    # Get seasons
                    seasons_data = await _request(srv["url"], token, f"/library/metadata/{rating_key}/children")
                    plex_seasons = {s.get("index"): s.get("ratingKey") for s in seasons_data.get("MediaContainer", {}).get("Metadata", [])}

                    for season_str, ep_nums in new_episodes.items():
                        season_num = int(season_str)
                        season_rk = plex_seasons.get(season_num)
                        if not season_rk:
                            continue

                        # Get episodes
                        eps_data = await _request(srv["url"], token, f"/library/metadata/{season_rk}/children")
                        plex_episodes = {e.get("index"): e.get("ratingKey") for e in eps_data.get("MediaContainer", {}).get("Metadata", [])}

                        for ep_num in ep_nums:
                            ep_rk = plex_episodes.get(ep_num)
                            if ep_rk:
                                try:
                                    await _scrobble(srv["url"], token, ep_rk)
                                except Exception:
                                    pass

                    logger.info(f"Synced episode progress to Plex {srv['name']}: {new_episodes}")
                    return  # Done with first server that has it

                except Exception:
                    continue
    except Exception as e:
        logger.error(f"Episode progress sync failed: {e}")

    # Also sync to Jellyfin
    try:
        async with async_session() as db:
            jf_servers = (await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user_id, JellyfinServer.enabled == True))).scalars().all()
            for srv in jf_servers:
                try:
                    item = await jf_service.find_by_tmdb(srv.url, srv.token, srv.jellyfin_user_id, tmdb_id, "tv")
                    if not item:
                        continue
                    seasons = await jf_service.get_seasons(srv.url, srv.token, srv.jellyfin_user_id, item["id"])
                    jf_seasons = {s.get("IndexNumber"): s.get("Id") for s in seasons}
                    for season_str, ep_nums in new_episodes.items():
                        season_id = jf_seasons.get(int(season_str))
                        if not season_id:
                            continue
                        episodes = await jf_service.get_episodes(srv.url, srv.token, srv.jellyfin_user_id, item["id"], season_id)
                        jf_eps = {e.get("IndexNumber"): e.get("Id") for e in episodes}
                        for ep_num in ep_nums:
                            ep_id = jf_eps.get(ep_num)
                            if ep_id:
                                await jf_service.mark_episode_watched(srv.url, srv.token, srv.jellyfin_user_id, ep_id)
                    logger.info(f"Synced episodes to Jellyfin {srv.name}")
                except Exception:
                    continue
    except Exception:
        pass


@router.put("/movies/{movie_id}", response_model=MovieOut)
async def update_movie(movie_id: int, data: MovieUpdate, background_tasks: BackgroundTasks, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404)

    # Check access
    await get_accessible_watchlist(movie.watchlist_id, user.id, db, need_edit=True)

    old_status = movie.status
    old_progress = dict(movie.watch_progress or {})

    update_data = data.model_dump(exclude_unset=True, mode="json")
    for key, value in update_data.items():
        setattr(movie, key, value)
    await db.flush()
    await db.refresh(movie)

    # Sync status change to Plex
    if "status" in update_data and movie.tmdb_id and movie.media_type:
        background_tasks.add_task(_sync_plex_watch_status, movie.tmdb_id, movie.media_type, data.status, movie.title, movie.year or "", user.id)

    # Sync episode progress changes to Plex
    if "watch_progress" in update_data and movie.tmdb_id and movie.media_type == "tv":
        new_progress = update_data["watch_progress"] or {}
        logger.warning(f"Episode progress changed for {movie.title}: old={old_progress} new={new_progress}")
        background_tasks.add_task(_sync_plex_episode_progress, movie.tmdb_id, old_progress, new_progress, user.id)

    return movie


@router.post("/movies/{movie_id}/enrich", response_model=MovieOut)
async def enrich_movie(movie_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Fetch missing metadata from TMDB for a movie."""
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404)

    await get_accessible_watchlist(movie.watchlist_id, user.id, db)

    if not movie.tmdb_id or not movie.media_type:
        raise HTTPException(status_code=400, detail="No TMDB ID")

    tmdb = TMDBService()
    try:
        data = await tmdb.details(movie.media_type, movie.tmdb_id)
    except Exception:
        raise HTTPException(status_code=502, detail="TMDB fetch failed")

    if not movie.poster_url and data.get("poster_path"):
        movie.poster_url = data["poster_path"]
    if not movie.backdrop_path and data.get("backdrop_path"):
        movie.backdrop_path = data["backdrop_path"]
    if not movie.overview and data.get("overview"):
        movie.overview = data["overview"]
    if not movie.vote_average and data.get("vote_average"):
        movie.vote_average = data["vote_average"]
    if not movie.genres and data.get("genres"):
        movie.genres = [g["id"] for g in data["genres"]]
    if not movie.year:
        date = data.get("release_date") or data.get("first_air_date") or ""
        if date:
            movie.year = date[:4]

    await db.flush()
    await db.refresh(movie)
    return movie


@router.delete("/movies/{movie_id}", status_code=204)
async def delete_movie(movie_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404)

    await get_accessible_watchlist(movie.watchlist_id, user.id, db, need_edit=True)
    await db.delete(movie)


# --- Friend Watchlist View ---
@router.get("/user/{username}", response_model=list[MovieOut])
async def get_user_watchlist(username: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    target = await db.execute(select(User).where(User.username == username))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check friendship
    friendship = await db.execute(
        select(Friend).where(
            Friend.status == "accepted",
            or_(
                (Friend.sender_id == user.id) & (Friend.receiver_id == target_user.id),
                (Friend.sender_id == target_user.id) & (Friend.receiver_id == user.id),
            ),
        )
    )
    is_friend = friendship.scalar_one_or_none() is not None

    # Get all their watchlists based on visibility
    result = await db.execute(select(Watchlist).where(Watchlist.owner_id == target_user.id))
    watchlists = result.scalars().all()

    if target_user.id != user.id and not is_friend:
        # Non-friends can only see public watchlists
        has_public = any(wl.visibility == "public" for wl in watchlists)
        if not has_public:
            raise HTTPException(status_code=403, detail="Not friends")

    all_movies = []
    for wl in watchlists:
        if wl.visibility == "private" and target_user.id != user.id:
            continue
        if wl.visibility == "friends" and not is_friend and target_user.id != user.id:
            continue

        movies_result = await db.execute(
            select(Movie).where(Movie.watchlist_id == wl.id).order_by(Movie.created_at.desc())
        )
        movies = movies_result.scalars().all()

        if target_user.id != user.id:
            movies = [m for m in movies if not m.is_private]
            for movie in movies:
                if movie.tags:
                    movie.tags = [t for t in movie.tags if not t.get("is_private", False)]

        all_movies.extend(movies)

    to_enrich = [m for m in all_movies if _needs_enrich(m)]
    if to_enrich:
        await _auto_enrich(to_enrich, db)
    return all_movies


# --- Legacy settings endpoint ---
@router.put("/settings", response_model=WatchlistSettings)
async def update_settings(data: WatchlistSettings, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await get_or_create_default(user.id, db)
    wl.visibility = data.visibility
    await db.flush()
    return WatchlistSettings(visibility=wl.visibility)


@router.get("/settings", response_model=WatchlistSettings)
async def get_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await get_or_create_default(user.id, db)
    return WatchlistSettings(visibility=wl.visibility)


# --- Export / Import ---

from datetime import datetime as dt_export


@router.get("/export")
async def export_data(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Export all user data as JSON."""
    wl_result = await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))
    watchlists = wl_result.scalars().all()

    export = {
        "version": 1,
        "exported_at": str(dt_export.utcnow()),
        "user": {"username": user.username, "plex_username": user.plex_username},
        "watchlists": [],
    }

    for wl in watchlists:
        movies_result = await db.execute(select(Movie).where(Movie.watchlist_id == wl.id))
        movies = movies_result.scalars().all()
        export["watchlists"].append({
            "name": wl.name, "icon": wl.icon, "visibility": wl.visibility, "is_default": wl.is_default,
            "movies": [
                {
                    "title": m.title, "year": m.year, "poster_url": m.poster_url, "backdrop_path": m.backdrop_path,
                    "overview": m.overview, "tmdb_id": m.tmdb_id, "media_type": m.media_type,
                    "vote_average": m.vote_average, "genres": m.genres, "status": m.status,
                    "rating": m.rating, "notes": m.notes, "tags": m.tags,
                    "watch_progress": m.watch_progress, "is_private": m.is_private, "created_at": str(m.created_at),
                }
                for m in movies
            ],
        })

    # Friends
    friend_result = await db.execute(
        select(Friend).where(or_(Friend.sender_id == user.id, Friend.receiver_id == user.id), Friend.status == "accepted")
    )
    friends = friend_result.scalars().all()
    friend_ids = {f.sender_id if f.receiver_id == user.id else f.receiver_id for f in friends}
    if friend_ids:
        users_result = await db.execute(select(User).where(User.id.in_(friend_ids)))
        export["friends"] = [u.username for u in users_result.scalars().all()]
    else:
        export["friends"] = []

    return export


@router.post("/import")
async def import_data(data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Import user data from JSON export."""
    if data.get("version") != 1:
        raise HTTPException(status_code=400, detail="Unbekanntes Export-Format")

    imported_movies = 0
    imported_watchlists = 0
    skipped = 0

    for wl_data in data.get("watchlists", []):
        if wl_data.get("is_default"):
            result = await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id, Watchlist.is_default == True))
            wl = result.scalar_one_or_none()
            if not wl:
                wl = Watchlist(owner_id=user.id, name=wl_data.get("name", "Import"), icon=wl_data.get("icon", "🎬"), is_default=True)
                db.add(wl)
                await db.flush()
                imported_watchlists += 1
        else:
            result = await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id, Watchlist.name == wl_data.get("name")))
            wl = result.scalar_one_or_none()
            if not wl:
                wl = Watchlist(owner_id=user.id, name=wl_data.get("name", "Import"), icon=wl_data.get("icon", "🎬"), visibility=wl_data.get("visibility", "friends"))
                db.add(wl)
                await db.flush()
                imported_watchlists += 1

        for m_data in wl_data.get("movies", []):
            if m_data.get("tmdb_id"):
                existing = await db.execute(select(Movie).where(Movie.watchlist_id == wl.id, Movie.tmdb_id == m_data["tmdb_id"], Movie.media_type == m_data.get("media_type")))
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

            db.add(Movie(
                watchlist_id=wl.id, title=m_data.get("title", "Unknown"), year=m_data.get("year"),
                poster_url=m_data.get("poster_url"), backdrop_path=m_data.get("backdrop_path"),
                overview=m_data.get("overview"), tmdb_id=m_data.get("tmdb_id"), media_type=m_data.get("media_type"),
                vote_average=m_data.get("vote_average"), genres=m_data.get("genres"),
                status=m_data.get("status", "watchlist"), rating=m_data.get("rating"), notes=m_data.get("notes"),
                tags=m_data.get("tags", []), watch_progress=m_data.get("watch_progress", {}),
                is_private=m_data.get("is_private", False),
            ))
            imported_movies += 1

    await db.flush()
    return {"imported_watchlists": imported_watchlists, "imported_movies": imported_movies, "skipped_duplicates": skipped}
