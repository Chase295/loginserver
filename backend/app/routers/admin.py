import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import ApiKey, DownloadProfile, JellyfinServer, Movie, PlexServer, RadarrServer, SonarrServer, TautulliServer, User, Watchlist

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def system_stats(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    users = await db.execute(select(func.count()).select_from(User))
    movies = await db.execute(select(func.count()).select_from(Movie))
    watchlists = await db.execute(select(func.count()).select_from(Watchlist))
    return {
        "users": users.scalar(),
        "movies": movies.scalar(),
        "watchlists": watchlists.scalar(),
    }


@router.get("/users")
async def list_users(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at))
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "is_installer": u.is_installer,
            "created_at": str(u.created_at),
        }
        for u in result.scalars().all()
    ]


@router.put("/users/{user_id}/admin")
async def toggle_admin(user_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        return {"error": "User not found"}
    if target.id == user.id:
        return {"error": "Cannot change own admin status"}
    target.is_admin = not target.is_admin
    await db.flush()
    return {"user_id": target.id, "is_admin": target.is_admin}


@router.put("/users/{user_id}/installer")
async def toggle_installer(user_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        return {"error": "User not found"}
    target.is_installer = not target.is_installer
    await db.flush()
    return {"user_id": target.id, "is_installer": target.is_installer}


# --- Download Profiles ---


@router.get("/download-profiles")
async def list_download_profiles(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DownloadProfile).order_by(DownloadProfile.created_at))
    return [
        {
            "id": p.id, "name": p.name, "match_type": p.match_type,
            "server_type": p.server_type, "server_id": p.server_id,
            "quality_profile_id": p.quality_profile_id, "root_folder_path": p.root_folder_path,
            "monitor_strategy": p.monitor_strategy, "auto_search": p.auto_search,
            "enabled": p.enabled,
        }
        for p in result.scalars().all()
    ]


# --- Toggle Service ---

SERVER_MODELS = {"tautulli": TautulliServer, "sonarr": SonarrServer, "radarr": RadarrServer, "plex": PlexServer, "jellyfin": JellyfinServer}


@router.put("/services/{service_type}/{server_id}/toggle")
async def toggle_service(service_type: str, server_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    model = SERVER_MODELS.get(service_type)
    if not model:
        raise HTTPException(status_code=400, detail="Unknown service type")
    result = await db.execute(select(model).where(model.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")
    server.enabled = not server.enabled
    await db.flush()
    return {"id": server.id, "name": server.name, "enabled": server.enabled}


# --- API Keys ---


@router.get("/api-keys")
async def list_api_keys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.user_id == user.id).order_by(ApiKey.created_at))
    return [
        {"id": k.id, "name": k.name, "key_preview": k.key[:8] + "...", "last_used": str(k.last_used) if k.last_used else None, "created_at": str(k.created_at)}
        for k in result.scalars().all()
    ]


@router.post("/api-keys")
async def create_api_key(data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    name = data.get("name", "MCP Key")
    key = secrets.token_hex(32)
    api_key = ApiKey(user_id=user.id, name=name, key=key)
    db.add(api_key)
    await db.flush()
    # Return full key ONCE — won't be shown again
    return {"id": api_key.id, "name": name, "key": key}


@router.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API Key nicht gefunden")
    await db.delete(api_key)
    await db.flush()
    return {"status": "ok"}


@router.post("/download-profiles")
async def create_download_profile(data: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    profile = DownloadProfile(
        name=data["name"],
        match_type=data["match_type"],
        server_type=data["server_type"],
        server_id=data["server_id"],
        quality_profile_id=data["quality_profile_id"],
        root_folder_path=data["root_folder_path"],
        monitor_strategy=data.get("monitor_strategy", "none"),
        auto_search=data.get("auto_search", False),
        enabled=data.get("enabled", True),
    )
    db.add(profile)
    await db.flush()
    return {"id": profile.id, "name": profile.name}


@router.put("/download-profiles/{profile_id}")
async def update_download_profile(profile_id: int, data: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DownloadProfile).where(DownloadProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil nicht gefunden")
    for key in ["name", "match_type", "server_type", "server_id", "quality_profile_id", "root_folder_path", "monitor_strategy", "auto_search", "enabled"]:
        if key in data:
            setattr(profile, key, data[key])
    await db.flush()
    return {"id": profile.id, "name": profile.name}


@router.delete("/download-profiles/{profile_id}")
async def delete_download_profile(profile_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DownloadProfile).where(DownloadProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil nicht gefunden")
    await db.delete(profile)
    await db.flush()
    return {"status": "ok"}
