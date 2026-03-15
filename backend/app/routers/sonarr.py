from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_admin, require_installer
from ..database import get_db
from ..models import SonarrServer, User
from ..schemas import SonarrAddSeries, SonarrServerCreate, SonarrServerUpdate
from ..services import sonarr as sonarr_service

router = APIRouter(prefix="/api/sonarr", tags=["sonarr"])


# --- Helper ---


async def _get_server(server_id: int, db: AsyncSession) -> SonarrServer:
    result = await db.execute(select(SonarrServer).where(SonarrServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")
    return server


# --- Admin: Server CRUD ---


@router.get("/servers")
async def list_servers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SonarrServer).order_by(SonarrServer.created_at))
    servers = result.scalars().all()
    if user.is_admin:
        return [
            {"id": s.id, "name": s.name, "url": s.url, "enabled": s.enabled, "created_at": str(s.created_at)}
            for s in servers
        ]
    return [{"id": s.id, "name": s.name, "enabled": s.enabled} for s in servers]


@router.post("/servers")
async def add_server(
    data: SonarrServerCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    server = SonarrServer(name=data.name, url=data.url.rstrip("/"), api_key=data.api_key)
    db.add(server)
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url}


@router.put("/servers/{server_id}")
async def update_server(
    server_id: int,
    data: SonarrServerUpdate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    if data.name is not None:
        server.name = data.name
    if data.url is not None:
        server.url = data.url.rstrip("/")
    if data.api_key is not None:
        server.api_key = data.api_key
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url}


@router.delete("/servers/{server_id}")
async def delete_server(
    server_id: int,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    await db.delete(server)
    await db.flush()
    return {"status": "ok"}


@router.post("/servers/{server_id}/test")
async def test_server(
    server_id: int,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        info = await sonarr_service.test_connection(server.url, server.api_key)
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verbindung fehlgeschlagen: {e}")


# --- Installer: Series Status (for MovieDetailModal) ---


@router.get("/status/{tmdb_id}")
async def sonarr_status(
    tmdb_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SonarrServer).where(SonarrServer.enabled == True))
    servers = result.scalars().all()

    if not servers:
        return {"found": False, "servers": []}

    found_servers = []
    for srv in servers:
        try:
            series = await sonarr_service.get_series_by_tmdb(srv.url, srv.api_key, tmdb_id)
            if not series:
                continue

            stats = series.get("statistics", {})
            total_episodes = stats.get("totalEpisodeCount", 0)
            episodes_on_disk = stats.get("episodeFileCount", 0)
            size_bytes = stats.get("sizeOnDisk", 0)
            percent = round((episodes_on_disk / total_episodes * 100), 1) if total_episodes > 0 else 0

            seasons = []
            for season in series.get("seasons", []):
                s_stats = season.get("statistics", {})
                seasons.append({
                    "number": season.get("seasonNumber"),
                    "monitored": season.get("monitored", False),
                    "episodes": s_stats.get("totalEpisodeCount", 0),
                    "files": s_stats.get("episodeFileCount", 0),
                    "percent": round(
                        (s_stats.get("episodeFileCount", 0) / s_stats.get("totalEpisodeCount", 1) * 100), 1
                    ) if s_stats.get("totalEpisodeCount", 0) > 0 else 0,
                })

            found_servers.append({
                "server_id": srv.id,
                "server_name": srv.name,
                "sonarr_id": series.get("id"),
                "monitored": series.get("monitored", False),
                "status": series.get("status", "unknown"),
                "total_episodes": total_episodes,
                "episodes_on_disk": episodes_on_disk,
                "percent_complete": percent,
                "size_gb": f"{size_bytes / (1024**3):.1f}",
                "seasons": seasons,
            })
        except Exception:
            continue

    return {"found": len(found_servers) > 0, "servers": found_servers}


# --- Installer: Server Config Data ---


@router.get("/servers/{server_id}/rootfolders")
async def root_folders(
    server_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        folders = await sonarr_service.get_root_folders(server.url, server.api_key)
        return [{"id": f.get("id"), "path": f.get("path"), "free_space_gb": round(f.get("freeSpace", 0) / (1024**3), 1)} for f in folders]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/servers/{server_id}/profiles")
async def quality_profiles(
    server_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        profiles = await sonarr_service.get_quality_profiles(server.url, server.api_key)
        return [{"id": p.get("id"), "name": p.get("name")} for p in profiles]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/servers/{server_id}/tags")
async def tags(
    server_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await sonarr_service.get_tags(server.url, server.api_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Lookup (preview before adding) ---


@router.get("/servers/{server_id}/lookup/{tmdb_id}")
async def lookup_series(
    server_id: int,
    tmdb_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    """Lookup a series by TMDB ID to preview before adding."""
    server = await _get_server(server_id, db)
    try:
        results = await sonarr_service.lookup_by_tmdb(server.url, server.api_key, tmdb_id)
        if not results:
            raise HTTPException(status_code=404, detail="Serie nicht in Sonarr-Datenbank gefunden")
        s = results[0]
        return {
            "title": s.get("title"),
            "year": s.get("year"),
            "overview": s.get("overview"),
            "tvdbId": s.get("tvdbId"),
            "status": s.get("status"),
            "network": s.get("network"),
            "seasonCount": s.get("statistics", {}).get("seasonCount", len(s.get("seasons", []))),
            "seasons": [
                {
                    "seasonNumber": sn.get("seasonNumber"),
                    "monitored": sn.get("monitored", True),
                    "statistics": sn.get("statistics", {}),
                }
                for sn in s.get("seasons", [])
            ],
            "images": s.get("images", []),
            "seriesType": s.get("seriesType", "standard"),
            "ratings": s.get("ratings", {}),
            "genres": s.get("genres", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Add Series ---


@router.post("/servers/{server_id}/add")
async def add_series_to_sonarr(
    server_id: int,
    data: SonarrAddSeries,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)

    try:
        lookup_results = await sonarr_service.lookup_by_tmdb(server.url, server.api_key, data.tmdb_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lookup fehlgeschlagen: {e}")

    if not lookup_results:
        raise HTTPException(status_code=404, detail="Serie nicht in Sonarr-Datenbank gefunden")

    series_data = lookup_results[0]

    add_payload = {
        "title": series_data.get("title", data.title),
        "tvdbId": series_data.get("tvdbId"),
        "qualityProfileId": data.quality_profile_id,
        "rootFolderPath": data.root_folder_path,
        "monitored": data.monitored,
        "seasonFolder": data.season_folder,
        "addOptions": {
            "monitor": data.monitor_strategy,
            "searchForMissingEpisodes": data.search_after_add,
        },
        "images": series_data.get("images", []),
        "seasons": series_data.get("seasons", []),
    }

    try:
        result = await sonarr_service.add_series(server.url, server.api_key, add_payload)
        return {"status": "ok", "sonarr_id": result.get("id"), "title": result.get("title")}
    except Exception as e:
        error_msg = str(e)
        if "already been added" in error_msg.lower() or "already exists" in error_msg.lower():
            raise HTTPException(status_code=409, detail="Serie existiert bereits auf diesem Server")
        raise HTTPException(status_code=400, detail=f"Hinzufügen fehlgeschlagen: {error_msg}")


# --- Installer: Series Management ---


@router.get("/servers/{server_id}/series")
async def list_series(
    server_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        series_list = await sonarr_service.get_all_series(server.url, server.api_key)
        return [
            {
                "id": s.get("id"),
                "title": s.get("title"),
                "sortTitle": s.get("sortTitle"),
                "status": s.get("status"),
                "monitored": s.get("monitored"),
                "seasonCount": s.get("statistics", {}).get("seasonCount", 0),
                "totalEpisodes": s.get("statistics", {}).get("totalEpisodeCount", 0),
                "episodeFileCount": s.get("statistics", {}).get("episodeFileCount", 0),
                "sizeOnDisk": s.get("statistics", {}).get("sizeOnDisk", 0),
                "percentComplete": round(
                    s.get("statistics", {}).get("episodeFileCount", 0)
                    / max(s.get("statistics", {}).get("totalEpisodeCount", 1), 1)
                    * 100,
                    1,
                ),
                "network": s.get("network"),
                "year": s.get("year"),
                "qualityProfileId": s.get("qualityProfileId"),
                "path": s.get("path"),
                "seriesType": s.get("seriesType"),
                "seasonFolder": s.get("seasonFolder"),
                "tags": s.get("tags", []),
                "images": s.get("images", []),
                "added": s.get("added"),
                "tmdbId": s.get("tmdbId"),
                "tvdbId": s.get("tvdbId"),
            }
            for s in series_list
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/servers/{server_id}/series/{sonarr_id}")
async def get_series_detail(
    server_id: int,
    sonarr_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        series = await sonarr_service.get_series(server.url, server.api_key, sonarr_id)
        return series
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/servers/{server_id}/series/{sonarr_id}")
async def update_series(
    server_id: int,
    sonarr_id: int,
    data: dict,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        # Fetch current series data and merge with updates
        current = await sonarr_service.get_series(server.url, server.api_key, sonarr_id)
        current.update(data)
        result = await sonarr_service.update_series(server.url, server.api_key, current)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/servers/{server_id}/series/{sonarr_id}")
async def delete_series(
    server_id: int,
    sonarr_id: int,
    delete_files: bool = Query(False),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        await sonarr_service.delete_series(server.url, server.api_key, sonarr_id, delete_files)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Episodes ---


@router.get("/servers/{server_id}/series/{sonarr_id}/episodes")
async def get_episodes(
    server_id: int,
    sonarr_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        episodes = await sonarr_service.get_episodes(server.url, server.api_key, sonarr_id)
        files = await sonarr_service.get_episode_files(server.url, server.api_key, sonarr_id)
        file_map = {f["id"]: f for f in files}

        result = []
        for ep in episodes:
            ep_data = {
                "id": ep.get("id"),
                "seasonNumber": ep.get("seasonNumber"),
                "episodeNumber": ep.get("episodeNumber"),
                "title": ep.get("title"),
                "airDateUtc": ep.get("airDateUtc"),
                "monitored": ep.get("monitored"),
                "hasFile": ep.get("hasFile"),
                "episodeFileId": ep.get("episodeFileId", 0),
            }
            if ep.get("hasFile") and ep.get("episodeFileId"):
                f = file_map.get(ep["episodeFileId"], {})
                ep_data["file"] = {
                    "id": f.get("id"),
                    "quality": f.get("quality", {}).get("quality", {}).get("name", "Unknown"),
                    "size": f.get("size", 0),
                    "path": f.get("path", ""),
                    "mediaInfo": f.get("mediaInfo"),
                }
            result.append(ep_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/servers/{server_id}/episodes/monitor")
async def set_episode_monitor(
    server_id: int,
    data: dict,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        result = await sonarr_service.set_episode_monitor(
            server.url, server.api_key,
            data["episodeIds"], data["monitored"],
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/servers/{server_id}/episodefile/{file_id}")
async def delete_episode_file(
    server_id: int,
    file_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        await sonarr_service.delete_episode_file(server.url, server.api_key, file_id)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Releases / Manual Search ---


@router.get("/servers/{server_id}/release")
async def search_releases(
    server_id: int,
    episodeId: int | None = Query(None),
    seriesId: int | None = Query(None),
    seasonNumber: int | None = Query(None),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        releases = await sonarr_service.search_releases(
            server.url, server.api_key,
            episode_id=episodeId, series_id=seriesId, season_number=seasonNumber,
        )
        return releases
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/servers/{server_id}/release")
async def grab_release(
    server_id: int,
    data: dict,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        result = await sonarr_service.grab_release(
            server.url, server.api_key,
            data["guid"], data["indexerId"],
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Commands ---


@router.post("/servers/{server_id}/command")
async def run_command(
    server_id: int,
    data: dict,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        result = await sonarr_service.run_command(server.url, server.api_key, data)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/servers/{server_id}/series/{sonarr_id}/search")
async def search_series(
    server_id: int,
    sonarr_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        result = await sonarr_service.trigger_search(server.url, server.api_key, sonarr_id)
        return {"status": "ok", "command_id": result.get("id")}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Suche fehlgeschlagen: {e}")


# --- Installer: Queue ---


@router.get("/servers/{server_id}/queue")
async def get_queue(
    server_id: int,
    page: int = Query(1),
    pageSize: int = Query(50),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await sonarr_service.get_queue(server.url, server.api_key, page, pageSize)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/servers/{server_id}/queue/{queue_id}")
async def remove_from_queue(
    server_id: int,
    queue_id: int,
    blocklist: bool = Query(False),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        await sonarr_service.remove_from_queue(server.url, server.api_key, queue_id, blocklist)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: History ---


@router.get("/servers/{server_id}/history")
async def get_history(
    server_id: int,
    seriesId: int | None = Query(None),
    episodeId: int | None = Query(None),
    page: int = Query(1),
    pageSize: int = Query(50),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await sonarr_service.get_history(
            server.url, server.api_key,
            series_id=seriesId, episode_id=episodeId,
            page=page, page_size=pageSize,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Calendar ---


@router.get("/servers/{server_id}/calendar")
async def get_calendar(
    server_id: int,
    start: str = Query(...),
    end: str = Query(...),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await sonarr_service.get_calendar(server.url, server.api_key, start, end)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Wanted ---


@router.get("/servers/{server_id}/wanted/missing")
async def get_wanted_missing(
    server_id: int,
    page: int = Query(1),
    pageSize: int = Query(50),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await sonarr_service.get_wanted_missing(server.url, server.api_key, page, pageSize)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/servers/{server_id}/wanted/cutoff")
async def get_cutoff_unmet(
    server_id: int,
    page: int = Query(1),
    pageSize: int = Query(50),
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await sonarr_service.get_cutoff_unmet(server.url, server.api_key, page, pageSize)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Disk Space ---


@router.get("/servers/{server_id}/diskspace")
async def get_disk_space(
    server_id: int,
    user: User = Depends(require_installer),
    db: AsyncSession = Depends(get_db),
):
    server = await _get_server(server_id, db)
    try:
        return await sonarr_service.get_disk_space(server.url, server.api_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
