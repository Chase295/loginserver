from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_admin, require_installer
from ..database import get_db
from ..models import RadarrServer, User
from ..schemas import RadarrAddMovie, RadarrServerCreate, RadarrServerUpdate
from ..services import radarr as radarr_service

router = APIRouter(prefix="/api/radarr", tags=["radarr"])


async def _get_server(server_id: int, db: AsyncSession) -> RadarrServer:
    result = await db.execute(select(RadarrServer).where(RadarrServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")
    return server


# --- Admin: Server CRUD ---


@router.get("/servers")
async def list_servers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RadarrServer).order_by(RadarrServer.created_at))
    servers = result.scalars().all()
    if user.is_admin:
        return [{"id": s.id, "name": s.name, "url": s.url, "enabled": s.enabled, "created_at": str(s.created_at)} for s in servers]
    return [{"id": s.id, "name": s.name, "enabled": s.enabled} for s in servers]


@router.post("/servers")
async def add_server(data: RadarrServerCreate, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    server = RadarrServer(name=data.name, url=data.url.rstrip("/"), api_key=data.api_key)
    db.add(server)
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url}


@router.put("/servers/{server_id}")
async def update_server(server_id: int, data: RadarrServerUpdate, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    if data.name is not None: server.name = data.name
    if data.url is not None: server.url = data.url.rstrip("/")
    if data.api_key is not None: server.api_key = data.api_key
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url}


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
        return await radarr_service.test_connection(server.url, server.api_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verbindung fehlgeschlagen: {e}")


# --- Installer: Status (for MovieDetailModal) ---


@router.get("/status/{tmdb_id}")
async def radarr_status(tmdb_id: int, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RadarrServer).where(RadarrServer.enabled == True))
    servers = result.scalars().all()
    if not servers:
        return {"found": False, "servers": []}

    found_servers = []
    for srv in servers:
        try:
            movie = await radarr_service.get_movie_by_tmdb(srv.url, srv.api_key, tmdb_id)
            if not movie:
                continue

            size_bytes = movie.get("sizeOnDisk", 0) or movie.get("movieFile", {}).get("size", 0) if movie.get("hasFile") else 0
            movie_file = movie.get("movieFile", {})

            found_servers.append({
                "server_id": srv.id,
                "server_name": srv.name,
                "radarr_id": movie.get("id"),
                "monitored": movie.get("monitored", False),
                "status": movie.get("status", "unknown"),
                "hasFile": movie.get("hasFile", False),
                "quality": movie_file.get("quality", {}).get("quality", {}).get("name") if movie_file else None,
                "size_gb": f"{size_bytes / (1024**3):.1f}" if size_bytes else "0.0",
                "path": movie.get("path", ""),
                "minimumAvailability": movie.get("minimumAvailability", "released"),
            })
        except Exception:
            continue

    return {"found": len(found_servers) > 0, "servers": found_servers}


# --- Installer: Lookup ---


@router.get("/servers/{server_id}/lookup/{tmdb_id}")
async def lookup_movie(server_id: int, tmdb_id: int, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        results = await radarr_service.lookup_by_tmdb(server.url, server.api_key, tmdb_id)
        if not results:
            raise HTTPException(status_code=404, detail="Film nicht in Radarr-Datenbank gefunden")
        m = results[0]
        return {
            "title": m.get("title"),
            "year": m.get("year"),
            "overview": m.get("overview"),
            "tmdbId": m.get("tmdbId"),
            "runtime": m.get("runtime"),
            "studio": m.get("studio"),
            "images": m.get("images", []),
            "genres": m.get("genres", []),
            "ratings": m.get("ratings", {}),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Config data ---


@router.get("/servers/{server_id}/rootfolders")
async def root_folders(server_id: int, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        folders = await radarr_service.get_root_folders(server.url, server.api_key)
        return [{"id": f.get("id"), "path": f.get("path"), "free_space_gb": round(f.get("freeSpace", 0) / (1024**3), 1)} for f in folders]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/servers/{server_id}/profiles")
async def quality_profiles(server_id: int, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        profiles = await radarr_service.get_quality_profiles(server.url, server.api_key)
        return [{"id": p.get("id"), "name": p.get("name")} for p in profiles]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/servers/{server_id}/tags")
async def tags(server_id: int, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await radarr_service.get_tags(server.url, server.api_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Add Movie ---


@router.post("/servers/{server_id}/add")
async def add_movie_to_radarr(server_id: int, data: RadarrAddMovie, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        lookup_results = await radarr_service.lookup_by_tmdb(server.url, server.api_key, data.tmdb_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lookup fehlgeschlagen: {e}")
    if not lookup_results:
        raise HTTPException(status_code=404, detail="Film nicht in Radarr-Datenbank gefunden")

    movie_data = lookup_results[0]
    add_payload = {
        "title": movie_data.get("title", data.title),
        "tmdbId": movie_data.get("tmdbId"),
        "qualityProfileId": data.quality_profile_id,
        "rootFolderPath": data.root_folder_path,
        "monitored": data.monitored,
        "minimumAvailability": data.minimum_availability,
        "addOptions": {"searchForMovie": data.search_after_add},
        "images": movie_data.get("images", []),
        "year": movie_data.get("year"),
    }

    try:
        result = await radarr_service.add_movie(server.url, server.api_key, add_payload)
        return {"status": "ok", "radarr_id": result.get("id"), "title": result.get("title")}
    except Exception as e:
        error_msg = str(e)
        if "already been added" in error_msg.lower() or "already exists" in error_msg.lower():
            raise HTTPException(status_code=409, detail="Film existiert bereits auf diesem Server")
        raise HTTPException(status_code=400, detail=f"Hinzufügen fehlgeschlagen: {error_msg}")


# --- Installer: Movie Management ---


@router.get("/servers/{server_id}/movie/{radarr_id}")
async def get_movie_detail(server_id: int, radarr_id: int, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await radarr_service.get_movie(server.url, server.api_key, radarr_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/servers/{server_id}/movie/{radarr_id}")
async def update_movie(server_id: int, radarr_id: int, data: dict, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        current = await radarr_service.get_movie(server.url, server.api_key, radarr_id)
        current.update(data)
        return await radarr_service.update_movie(server.url, server.api_key, current)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/servers/{server_id}/movie/{radarr_id}")
async def delete_movie(server_id: int, radarr_id: int, delete_files: bool = Query(False), user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        await radarr_service.delete_movie(server.url, server.api_key, radarr_id, delete_files)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Releases ---


@router.get("/servers/{server_id}/release")
async def search_releases(server_id: int, movieId: int = Query(...), user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await radarr_service.search_releases(server.url, server.api_key, movieId)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/servers/{server_id}/release")
async def grab_release(server_id: int, data: dict, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await radarr_service.grab_release(server.url, server.api_key, data["guid"], data["indexerId"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Commands ---


@router.post("/servers/{server_id}/command")
async def run_command(server_id: int, data: dict, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await radarr_service.run_command(server.url, server.api_key, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: Queue ---


@router.get("/servers/{server_id}/queue")
async def get_queue(server_id: int, user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await radarr_service.get_queue(server.url, server.api_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/servers/{server_id}/queue/{queue_id}")
async def remove_from_queue(server_id: int, queue_id: int, blocklist: bool = Query(False), user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        await radarr_service.remove_from_queue(server.url, server.api_key, queue_id, blocklist)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Installer: History ---


@router.get("/servers/{server_id}/history")
async def get_history(server_id: int, movieId: int | None = Query(None), user: User = Depends(require_installer), db: AsyncSession = Depends(get_db)):
    server = await _get_server(server_id, db)
    try:
        return await radarr_service.get_history(server.url, server.api_key, movie_id=movieId)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
