"""
MCP (Model Context Protocol) Server
- Streamable HTTP: POST /mcp/message
- SSE: GET /sse (event stream) + POST /sse/message (send)
Both authenticated via API key (Bearer token or query param).
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session, get_db
from ..models import ApiKey, DownloadProfile, Movie, PlexServer, RadarrServer, SonarrServer, User, Watchlist
from ..services import plex as plex_service, radarr as radarr_service, sonarr as sonarr_service
from ..services.tmdb import TMDBService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["mcp"])


# ─── Auth ──────────────────────────────────────────────────────────


async def _authenticate_mcp(request: Request, api_key: str | None = Query(None, alias="key")) -> User:
    """Authenticate MCP request via Bearer token or query param."""
    token = api_key

    # Check Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="API key required. Pass as Bearer token or ?key= query param.")

    async with async_session() as db:
        result = await db.execute(select(ApiKey).where(ApiKey.key == token))
        key_obj = result.scalar_one_or_none()
        if not key_obj:
            raise HTTPException(status_code=401, detail="Invalid API key")

        # Update last_used
        key_obj.last_used = datetime.utcnow()
        await db.commit()

        # Get user
        result = await db.execute(select(User).where(User.id == key_obj.user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user


# ─── Tool Definitions ─────────────────────────────────────────────

TOOLS = [
    {
        "name": "get_watchlist",
        "description": "Get all movies/series from the user's watchlist. Can filter by status (watchlist, watching, watched, planned, dropped) and media_type (movie, tv).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["watchlist", "watching", "watched", "planned", "dropped"]},
                "media_type": {"type": "string", "enum": ["movie", "tv"]},
            },
        },
    },
    {
        "name": "search_tmdb",
        "description": "Search for movies or TV series on TMDB.",
        "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    },
    {
        "name": "add_to_watchlist",
        "description": "Add a movie or series to the watchlist by TMDB ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tmdb_id": {"type": "integer"}, "media_type": {"type": "string", "enum": ["movie", "tv"]},
                "status": {"type": "string", "enum": ["watchlist", "watching", "planned"], "default": "watchlist"},
            },
            "required": ["tmdb_id", "media_type"],
        },
    },
    {
        "name": "set_status",
        "description": "Change the watchlist status of a movie/series.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tmdb_id": {"type": "integer"},
                "status": {"type": "string", "enum": ["watchlist", "watching", "watched", "planned", "dropped"]},
            },
            "required": ["tmdb_id", "status"],
        },
    },
    {
        "name": "remove_from_watchlist",
        "description": "Remove a movie/series from the watchlist.",
        "inputSchema": {"type": "object", "properties": {"tmdb_id": {"type": "integer"}}, "required": ["tmdb_id"]},
    },
    {
        "name": "check_plex",
        "description": "Check if a movie/series is available on Plex. Shows quality, codec, size, watch count.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "media_type": {"type": "string", "enum": ["movie", "tv"]}},
            "required": ["tmdb_id", "media_type"],
        },
    },
    {
        "name": "check_sonarr",
        "description": "Check Sonarr status of a TV series — download progress, episodes, monitoring.",
        "inputSchema": {"type": "object", "properties": {"tmdb_id": {"type": "integer"}}, "required": ["tmdb_id"]},
    },
    {
        "name": "check_radarr",
        "description": "Check Radarr status of a movie — downloaded, quality, size.",
        "inputSchema": {"type": "object", "properties": {"tmdb_id": {"type": "integer"}}, "required": ["tmdb_id"]},
    },
    {
        "name": "add_to_sonarr",
        "description": "Add a TV series to Sonarr for downloading.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "search_after_add": {"type": "boolean", "default": False}},
            "required": ["tmdb_id"],
        },
    },
    {
        "name": "add_to_radarr",
        "description": "Add a movie to Radarr for downloading.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "search_after_add": {"type": "boolean", "default": False}},
            "required": ["tmdb_id"],
        },
    },
    {
        "name": "delete_from_sonarr",
        "description": "Remove a TV series from Sonarr. Optionally delete files.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "delete_files": {"type": "boolean", "default": False}},
            "required": ["tmdb_id"],
        },
    },
    {
        "name": "delete_from_radarr",
        "description": "Remove a movie from Radarr. Optionally delete files.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "delete_files": {"type": "boolean", "default": False}},
            "required": ["tmdb_id"],
        },
    },
    {
        "name": "search_releases",
        "description": "Search available releases for a movie/series. Shows quality, size, language, seeds, indexer.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "media_type": {"type": "string", "enum": ["movie", "tv"]}},
            "required": ["tmdb_id", "media_type"],
        },
    },
    {
        "name": "get_trending",
        "description": "Get currently trending movies and TV series.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "grab_release",
        "description": "Download a specific release found via search_releases. Needs the guid and indexerId from search results.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "media_type": {"type": "string", "enum": ["movie", "tv"]}, "guid": {"type": "string"}, "indexer_id": {"type": "integer"}},
            "required": ["tmdb_id", "media_type", "guid", "indexer_id"],
        },
    },
    {
        "name": "get_stats",
        "description": "Get watchlist statistics: total movies, series, episodes watched, status breakdown.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "check_jellyfin",
        "description": "Check if a movie/series is available on Jellyfin. Shows played status.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "media_type": {"type": "string", "enum": ["movie", "tv"]}},
            "required": ["tmdb_id", "media_type"],
        },
    },
    {
        "name": "get_episode_progress",
        "description": "Get which episodes of a TV series have been watched. Returns per-season episode lists.",
        "inputSchema": {"type": "object", "properties": {"tmdb_id": {"type": "integer"}}, "required": ["tmdb_id"]},
    },
    {
        "name": "set_rating",
        "description": "Set a 1-5 star rating for a movie/series in the watchlist.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "rating": {"type": "integer", "minimum": 1, "maximum": 5}},
            "required": ["tmdb_id", "rating"],
        },
    },
    {
        "name": "add_tags",
        "description": "Add tags to a movie/series (e.g. 'Anime', 'Must Watch'). Each tag has a label and optional color.",
        "inputSchema": {
            "type": "object",
            "properties": {"tmdb_id": {"type": "integer"}, "tags": {"type": "array", "items": {"type": "string"}}},
            "required": ["tmdb_id", "tags"],
        },
    },
    {
        "name": "get_recommendations",
        "description": "Get personalized recommendations based on your watchlist — shows unwatched items similar to what you liked.",
        "inputSchema": {"type": "object", "properties": {"limit": {"type": "integer", "default": 10}}},
    },
]

# ─── Tool Handlers ─────────────────────────────────────────────────


async def _handle_tool(name: str, args: dict, user: User) -> Any:
    handlers = {
        "get_watchlist": _get_watchlist, "search_tmdb": _search_tmdb,
        "add_to_watchlist": _add_to_watchlist, "set_status": _set_status,
        "remove_from_watchlist": _remove_from_watchlist, "check_plex": _check_plex,
        "check_sonarr": _check_sonarr, "check_radarr": _check_radarr,
        "add_to_sonarr": _add_to_sonarr, "add_to_radarr": _add_to_radarr,
        "delete_from_sonarr": _delete_from_sonarr, "delete_from_radarr": _delete_from_radarr,
        "search_releases": _search_releases, "get_trending": _get_trending,
        "grab_release": _grab_release, "get_stats": _get_stats,
        "check_jellyfin": _check_jellyfin, "get_episode_progress": _get_episode_progress,
        "set_rating": _set_rating, "add_tags": _add_tags, "get_recommendations": _get_recommendations,
    }
    handler = handlers.get(name)
    if not handler:
        return {"error": f"Unknown tool: {name}"}
    return await handler(args, user)


async def _get_watchlist(args, user):
    async with async_session() as db:
        query = select(Movie).join(Watchlist).where(Watchlist.owner_id == user.id)
        if args.get("status"): query = query.where(Movie.status == args["status"])
        if args.get("media_type"): query = query.where(Movie.media_type == args["media_type"])
        result = await db.execute(query.order_by(Movie.created_at.desc()).limit(50))
        return [{"title": m.title, "year": m.year, "tmdb_id": m.tmdb_id, "media_type": m.media_type, "status": m.status, "rating": m.rating, "tags": m.tags} for m in result.scalars().all()]


async def _search_tmdb(args, user):
    results = await TMDBService().search(args["query"])
    return [{"tmdb_id": r.get("id"), "title": r.get("title") or r.get("name"), "year": (r.get("release_date") or r.get("first_air_date") or "")[:4], "media_type": r.get("media_type"), "overview": (r.get("overview") or "")[:150]} for r in (results.get("results") or [])[:10]]


async def _add_to_watchlist(args, user):
    detail = await TMDBService().details(args["media_type"], args["tmdb_id"])
    if not detail: return {"error": "Not found on TMDB"}
    async with async_session() as db:
        existing = await db.execute(select(Movie).join(Watchlist).where(Watchlist.owner_id == user.id, Movie.tmdb_id == args["tmdb_id"], Movie.media_type == args["media_type"]))
        if existing.scalar_one_or_none(): return {"error": "Already in watchlist"}
        wl = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id, Watchlist.is_default == True))).scalar_one_or_none()
        if not wl: return {"error": "No default watchlist"}
        movie = Movie(watchlist_id=wl.id, title=detail.get("title") or detail.get("name"), year=str(detail.get("release_date") or detail.get("first_air_date") or "")[:4], poster_url=detail.get("poster_path"), tmdb_id=args["tmdb_id"], media_type=args["media_type"], status=args.get("status", "watchlist"))
        db.add(movie)
        await db.commit()
        return {"success": True, "title": movie.title}


async def _set_status(args, user):
    async with async_session() as db:
        result = await db.execute(select(Movie).join(Watchlist).where(Watchlist.owner_id == user.id, Movie.tmdb_id == args["tmdb_id"]))
        movie = result.scalar_one_or_none()
        if not movie: return {"error": "Not in watchlist"}
        old = movie.status; movie.status = args["status"]; await db.commit()
        return {"success": True, "title": movie.title, "old_status": old, "new_status": args["status"]}


async def _remove_from_watchlist(args, user):
    async with async_session() as db:
        result = await db.execute(select(Movie).join(Watchlist).where(Watchlist.owner_id == user.id, Movie.tmdb_id == args["tmdb_id"]))
        movie = result.scalar_one_or_none()
        if not movie: return {"error": "Not in watchlist"}
        title = movie.title; await db.delete(movie); await db.commit()
        return {"success": True, "title": title}


async def _check_plex(args, user):
    async with async_session() as db:
        servers = (await db.execute(select(PlexServer))).scalars().all()
        found = []
        for srv in servers:
            try:
                item = await plex_service.find_by_guid(srv.url, srv.token, args["tmdb_id"], args["media_type"])
                if item: found.append({"server": srv.name, "resolution": item.get("videoResolution"), "codec": item.get("videoCodec"), "size_gb": round(item.get("fileSize", 0) / (1024**3), 1) if item.get("fileSize") else None, "view_count": item.get("viewCount", 0)})
            except Exception: continue
        return {"found": len(found) > 0, "servers": found}


async def _check_sonarr(args, user):
    async with async_session() as db:
        servers = (await db.execute(select(SonarrServer))).scalars().all()
        found = []
        for srv in servers:
            try:
                s = await sonarr_service.get_series_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
                if s:
                    st = s.get("statistics", {})
                    found.append({"server": srv.name, "title": s.get("title"), "episodes": f"{st.get('episodeFileCount', 0)}/{st.get('totalEpisodeCount', 0)}", "size_gb": round(st.get("sizeOnDisk", 0) / (1024**3), 1), "monitored": s.get("monitored")})
            except Exception: continue
        return {"found": len(found) > 0, "servers": found}


async def _check_radarr(args, user):
    async with async_session() as db:
        servers = (await db.execute(select(RadarrServer))).scalars().all()
        found = []
        for srv in servers:
            try:
                m = await radarr_service.get_movie_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
                if m: found.append({"server": srv.name, "title": m.get("title"), "has_file": m.get("hasFile"), "quality": m.get("movieFile", {}).get("quality", {}).get("quality", {}).get("name") if m.get("hasFile") else None, "size_gb": round(m.get("sizeOnDisk", 0) / (1024**3), 1)})
            except Exception: continue
        return {"found": len(found) > 0, "servers": found}


async def _add_to_sonarr(args, user):
    async with async_session() as db:
        srv = (await db.execute(select(SonarrServer).limit(1))).scalar_one_or_none()
        if not srv: return {"error": "No Sonarr server"}
        if await sonarr_service.get_series_by_tmdb(srv.url, srv.api_key, args["tmdb_id"]): return {"error": "Already on Sonarr"}
        lookup = await sonarr_service.lookup_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
        if not lookup: return {"error": "Not found"}
        profiles = await sonarr_service.get_quality_profiles(srv.url, srv.api_key)
        folders = await sonarr_service.get_root_folders(srv.url, srv.api_key)
        dp = (await db.execute(select(DownloadProfile).where(DownloadProfile.server_type == "sonarr", DownloadProfile.enabled == True).limit(1))).scalar_one_or_none()
        sd = lookup[0]
        added = await sonarr_service.add_series(srv.url, srv.api_key, {"title": sd.get("title"), "tvdbId": sd.get("tvdbId"), "qualityProfileId": dp.quality_profile_id if dp else profiles[0]["id"], "rootFolderPath": dp.root_folder_path if dp else folders[0]["path"], "monitored": True, "seasonFolder": True, "addOptions": {"monitor": dp.monitor_strategy if dp else "none", "searchForMissingEpisodes": args.get("search_after_add", False)}, "images": sd.get("images", []), "seasons": sd.get("seasons", [])})
        return {"success": True, "title": added.get("title")}


async def _add_to_radarr(args, user):
    async with async_session() as db:
        srv = (await db.execute(select(RadarrServer).limit(1))).scalar_one_or_none()
        if not srv: return {"error": "No Radarr server"}
        if await radarr_service.get_movie_by_tmdb(srv.url, srv.api_key, args["tmdb_id"]): return {"error": "Already on Radarr"}
        lookup = await radarr_service.lookup_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
        if not lookup: return {"error": "Not found"}
        profiles = await radarr_service.get_quality_profiles(srv.url, srv.api_key)
        folders = await radarr_service.get_root_folders(srv.url, srv.api_key)
        dp = (await db.execute(select(DownloadProfile).where(DownloadProfile.server_type == "radarr", DownloadProfile.enabled == True).limit(1))).scalar_one_or_none()
        md = lookup[0]
        added = await radarr_service.add_movie(srv.url, srv.api_key, {"title": md.get("title"), "tmdbId": md.get("tmdbId"), "qualityProfileId": dp.quality_profile_id if dp else profiles[0]["id"], "rootFolderPath": dp.root_folder_path if dp else folders[0]["path"], "monitored": True, "minimumAvailability": "released", "addOptions": {"searchForMovie": args.get("search_after_add", False)}, "images": md.get("images", []), "year": md.get("year")})
        return {"success": True, "title": added.get("title")}


async def _delete_from_sonarr(args, user):
    async with async_session() as db:
        for srv in (await db.execute(select(SonarrServer))).scalars().all():
            try:
                s = await sonarr_service.get_series_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
                if not s: continue
                await sonarr_service.delete_series(srv.url, srv.api_key, s["id"], args.get("delete_files", False))
                return {"success": True, "title": s.get("title")}
            except Exception as e: return {"error": str(e)}
    return {"error": "Not found on Sonarr"}


async def _delete_from_radarr(args, user):
    async with async_session() as db:
        for srv in (await db.execute(select(RadarrServer))).scalars().all():
            try:
                m = await radarr_service.get_movie_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
                if not m: continue
                await radarr_service.delete_movie(srv.url, srv.api_key, m["id"], args.get("delete_files", False))
                return {"success": True, "title": m.get("title")}
            except Exception as e: return {"error": str(e)}
    return {"error": "Not found on Radarr"}


async def _search_releases(args, user):
    async with async_session() as db:
        if args["media_type"] == "movie":
            srv = (await db.execute(select(RadarrServer).limit(1))).scalar_one_or_none()
            if not srv: return {"error": "No Radarr server"}
            m = await radarr_service.get_movie_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
            if not m: return {"error": "Movie not on Radarr"}
            releases = await radarr_service.search_releases(srv.url, srv.api_key, m["id"])
        else:
            srv = (await db.execute(select(SonarrServer).limit(1))).scalar_one_or_none()
            if not srv: return {"error": "No Sonarr server"}
            s = await sonarr_service.get_series_by_tmdb(srv.url, srv.api_key, args["tmdb_id"])
            if not s: return {"error": "Series not on Sonarr"}
            releases = await sonarr_service.search_releases(srv.url, srv.api_key, series_id=s["id"])
    return [{"title": r.get("title"), "quality": r.get("quality", {}).get("quality", {}).get("name"), "size_gb": round(r.get("size", 0) / (1024**3), 1), "languages": [l.get("name") for l in r.get("languages", [])], "seeders": r.get("seeders"), "indexer": r.get("indexer")} for r in releases[:20]]


async def _get_trending(args, user):
    results = await TMDBService().trending()
    return [{"tmdb_id": r.get("id"), "title": r.get("title") or r.get("name"), "media_type": r.get("media_type"), "year": (r.get("release_date") or r.get("first_air_date") or "")[:4]} for r in (results.get("results") or [])[:15]]


async def _grab_release(args, user):
    async with async_session() as db:
        if args["media_type"] == "movie":
            srv = (await db.execute(select(RadarrServer).limit(1))).scalar_one_or_none()
            if not srv: return {"error": "No Radarr server"}
            await radarr_service.grab_release(srv.url, srv.api_key, args["guid"], args["indexer_id"])
        else:
            srv = (await db.execute(select(SonarrServer).limit(1))).scalar_one_or_none()
            if not srv: return {"error": "No Sonarr server"}
            await sonarr_service.grab_release(srv.url, srv.api_key, args["guid"], args["indexer_id"])
    return {"success": True, "message": "Release wird heruntergeladen"}


async def _get_stats(args, user):
    async with async_session() as db:
        from sqlalchemy import func
        all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))).scalars().all()
        wl_ids = [w.id for w in all_wls]
        if not wl_ids: return {"total": 0}
        movies = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(wl_ids)))).scalars().all()
        stats = {"total": len(movies), "movies": 0, "movies_watched": 0, "series": 0, "series_watched": 0, "episodes_watched": 0, "by_status": {}}
        for m in movies:
            if m.media_type == "movie":
                stats["movies"] += 1
                if m.status == "watched": stats["movies_watched"] += 1
            else:
                stats["series"] += 1
                if m.status == "watched": stats["series_watched"] += 1
            stats["by_status"][m.status] = stats["by_status"].get(m.status, 0) + 1
            if m.watch_progress:
                for eps in m.watch_progress.values():
                    if isinstance(eps, list): stats["episodes_watched"] += len(eps)
        return stats


async def _check_jellyfin(args, user):
    from ..services import jellyfin as jf_svc
    from ..models import JellyfinServer
    async with async_session() as db:
        servers = (await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user.id, JellyfinServer.enabled == True))).scalars().all()
        found = []
        for srv in servers:
            try:
                item = await jf_svc.find_by_tmdb(srv.url, srv.token, srv.jellyfin_user_id, args["tmdb_id"], args["media_type"])
                if item: found.append({"server": srv.name, "title": item.get("name"), "played": item.get("played"), "play_count": item.get("playCount", 0)})
            except Exception: continue
        return {"found": len(found) > 0, "servers": found}


async def _get_episode_progress(args, user):
    async with async_session() as db:
        all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))).scalars().all()
        wl_ids = [w.id for w in all_wls]
        movie = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(wl_ids), Movie.tmdb_id == args["tmdb_id"]))).scalars().first()
        if not movie: return {"error": "Not in watchlist"}
        progress = movie.watch_progress or {}
        total_eps = sum(len(eps) for eps in progress.values())
        return {"title": movie.title, "status": movie.status, "total_episodes_watched": total_eps, "progress": progress}


async def _set_rating(args, user):
    async with async_session() as db:
        all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))).scalars().all()
        wl_ids = [w.id for w in all_wls]
        movie = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(wl_ids), Movie.tmdb_id == args["tmdb_id"]))).scalars().first()
        if not movie: return {"error": "Not in watchlist"}
        movie.rating = args["rating"]
        await db.commit()
        return {"success": True, "title": movie.title, "rating": args["rating"]}


async def _add_tags(args, user):
    async with async_session() as db:
        all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))).scalars().all()
        wl_ids = [w.id for w in all_wls]
        movie = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(wl_ids), Movie.tmdb_id == args["tmdb_id"]))).scalars().first()
        if not movie: return {"error": "Not in watchlist"}
        existing = movie.tags or []
        existing_labels = {t.get("label", "").lower() for t in existing if isinstance(t, dict)}
        colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"]
        for i, tag in enumerate(args["tags"]):
            if tag.lower() not in existing_labels:
                existing.append({"label": tag, "color": colors[i % len(colors)], "is_private": False})
        movie.tags = existing
        await db.commit()
        return {"success": True, "title": movie.title, "tags": [t["label"] for t in movie.tags]}


async def _get_recommendations(args, user):
    async with async_session() as db:
        all_wls = (await db.execute(select(Watchlist).where(Watchlist.owner_id == user.id))).scalars().all()
        wl_ids = [w.id for w in all_wls]
        movies = (await db.execute(select(Movie).where(Movie.watchlist_id.in_(wl_ids)))).scalars().all()
        # Find highly rated or recently watched
        liked = [m for m in movies if (m.rating and m.rating >= 4) or m.status == "watched"]
        if not liked: return {"recommendations": [], "message": "Noch nicht genug geschaut für Empfehlungen"}
        # Pick a random liked item and get TMDB recommendations
        import random
        pick = random.choice(liked[:20])
        if not pick.tmdb_id or not pick.media_type: return {"recommendations": []}
        try:
            tmdb = TMDBService()
            data = await tmdb._get(f"/{pick.media_type}/{pick.tmdb_id}/recommendations", {"language": "de-DE"})
            watched_ids = {m.tmdb_id for m in movies}
            recs = [{"tmdb_id": r.get("id"), "title": r.get("title") or r.get("name"), "media_type": r.get("media_type"), "year": (r.get("release_date") or r.get("first_air_date") or "")[:4], "vote_average": r.get("vote_average")}
                    for r in (data.get("results") or []) if r.get("id") not in watched_ids]
            limit = args.get("limit", 10)
            return {"based_on": pick.title, "recommendations": recs[:limit]}
        except Exception:
            return {"recommendations": [], "error": "TMDB nicht erreichbar"}


# ─── Process JSON-RPC message ─────────────────────────────────────


async def _process_message(body: dict, user: User) -> dict | None:
    method = body.get("method")
    msg_id = body.get("id")
    params = body.get("params", {})

    if method == "initialize":
        return _rpc_ok(msg_id, {"protocolVersion": "2024-11-05", "capabilities": {"tools": {"listChanged": False}}, "serverInfo": {"name": "watchlist-mcp", "version": "1.0.0"}})
    if method == "ping":
        return _rpc_ok(msg_id, {})
    if method == "tools/list":
        return _rpc_ok(msg_id, {"tools": TOOLS})
    if method == "tools/call":
        tool_name = params.get("name")
        try:
            result = await _handle_tool(tool_name, params.get("arguments", {}), user)
            return _rpc_ok(msg_id, {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]})
        except Exception as e:
            logger.error(f"MCP tool error ({tool_name}): {e}")
            return _rpc_ok(msg_id, {"content": [{"type": "text", "text": json.dumps({"error": str(e)})}], "isError": True})
    if method and method.startswith("notifications/"):
        return None  # no response for notifications
    return _rpc_err(msg_id, -32601, f"Method not found: {method}")


def _rpc_ok(msg_id, result):
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _rpc_err(msg_id, code, message):
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


# ═══════════════════════════════════════════════════════════════════
# ─── HTTP Transport: POST /mcp/message ────────────────────────────
# ═══════════════════════════════════════════════════════════════════


@router.post("/mcp/message")
async def mcp_http(request: Request, user: User = Depends(_authenticate_mcp)):
    body = await request.json()
    result = await _process_message(body, user)
    if result is None:
        return JSONResponse(content={}, status_code=202)
    return JSONResponse(content=result)


# ═══════════════════════════════════════════════════════════════════
# ─── SSE Transport: GET /sse + POST /sse/message ──────────────────
# ═══════════════════════════════════════════════════════════════════

# Store active SSE sessions
_sse_sessions: dict[str, dict] = {}  # session_id -> {"user": User, "queue": asyncio.Queue}


@router.get("/sse")
async def mcp_sse(request: Request, user: User = Depends(_authenticate_mcp)):
    """SSE endpoint — client connects here and receives events."""
    session_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    _sse_sessions[session_id] = {"user": user, "queue": queue}

    async def event_stream():
        # Send endpoint event so client knows where to POST
        yield f"event: endpoint\ndata: /sse/message?session_id={session_id}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"event: message\ndata: {json.dumps(message, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield ": keepalive\n\n"
        finally:
            _sse_sessions.pop(session_id, None)

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})


@router.post("/sse/message")
async def mcp_sse_message(request: Request, session_id: str = Query(...)):
    """SSE message endpoint — client sends JSON-RPC here."""
    session = _sse_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    body = await request.json()
    result = await _process_message(body, session["user"])

    if result is not None:
        await session["queue"].put(result)

    return JSONResponse(content={"status": "ok"})
