import base64
import hashlib
import secrets

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_admin
from ..config import get_settings
from ..database import get_db
from ..models import ApiKey, DownloadProfile, JellyfinServer, Movie, PlexServer, RadarrServer, SonarrServer, SystemSetting, TautulliServer, User, Watchlist


def _get_fernet():
    """Create Fernet cipher from JWT secret."""
    key = hashlib.sha256(get_settings().jwt_secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def _encrypt(value: str | None) -> str | None:
    if not value:
        return None
    return _get_fernet().encrypt(value.encode()).decode()


def _decrypt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _get_fernet().decrypt(value.encode()).decode()
    except Exception:
        return value  # Return as-is if decryption fails (might be plaintext)

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


# --- Settings ---


@router.get("/settings/jellyfin-login-url")
async def get_jellyfin_login_url(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(SystemSetting).where(SystemSetting.key == "jellyfin_login_url"))).scalar_one_or_none()
    return {"url": s.value if s else None}


@router.put("/settings/jellyfin-login-url")
async def set_jellyfin_login_url(data: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    url = data.get("url", "").rstrip("/")
    s = (await db.execute(select(SystemSetting).where(SystemSetting.key == "jellyfin_login_url"))).scalar_one_or_none()
    if s:
        if url:
            s.value = url
        else:
            await db.delete(s)
    elif url:
        db.add(SystemSetting(key="jellyfin_login_url", value=url))
    await db.flush()
    return {"url": url or None}


# --- Admin Full Export/Import ---


@router.get("/export")
async def admin_export(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Export ALL server configs + settings with encrypted tokens."""
    from datetime import datetime

    export = {
        "version": 2,
        "type": "admin_full",
        "exported_at": str(datetime.utcnow()),
        "exported_by": user.username,
    }

    # Sonarr
    servers = (await db.execute(select(SonarrServer))).scalars().all()
    export["sonarr_servers"] = [{"name": s.name, "url": s.url, "api_key": _encrypt(s.api_key), "enabled": s.enabled} for s in servers]

    # Radarr
    servers = (await db.execute(select(RadarrServer))).scalars().all()
    export["radarr_servers"] = [{"name": s.name, "url": s.url, "api_key": _encrypt(s.api_key), "enabled": s.enabled} for s in servers]

    # Tautulli
    servers = (await db.execute(select(TautulliServer))).scalars().all()
    export["tautulli_servers"] = [{"name": s.name, "url": s.url, "api_key": _encrypt(s.api_key), "enabled": s.enabled} for s in servers]

    # Plex
    servers = (await db.execute(select(PlexServer))).scalars().all()
    export["plex_servers"] = [{"name": s.name, "url": s.url, "token": _encrypt(s.token), "machine_id": s.machine_id, "enabled": s.enabled} for s in servers]

    # Jellyfin
    servers = (await db.execute(select(JellyfinServer))).scalars().all()
    export["jellyfin_servers"] = [{"name": s.name, "url": s.url, "token": _encrypt(s.token), "jellyfin_user_id": s.jellyfin_user_id, "jf_username": s.jf_username, "jf_password": _encrypt(s.jf_password), "user_id": s.user_id, "enabled": s.enabled} for s in servers]

    # Download Profiles
    profiles = (await db.execute(select(DownloadProfile))).scalars().all()
    export["download_profiles"] = [{"name": p.name, "match_type": p.match_type, "server_type": p.server_type, "server_id": p.server_id, "quality_profile_id": p.quality_profile_id, "root_folder_path": p.root_folder_path, "monitor_strategy": p.monitor_strategy, "auto_search": p.auto_search, "enabled": p.enabled} for p in profiles]

    # System Settings
    settings = (await db.execute(select(SystemSetting))).scalars().all()
    export["system_settings"] = [{"key": s.key, "value": s.value} for s in settings]

    return export


@router.post("/import")
async def admin_import(data: dict, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Import server configs + settings. Tokens are decrypted."""
    if data.get("version") != 2 or data.get("type") != "admin_full":
        raise HTTPException(status_code=400, detail="Ungültiges Admin-Export Format (Version 2 erwartet)")

    imported = {"sonarr": 0, "radarr": 0, "tautulli": 0, "plex": 0, "jellyfin": 0, "profiles": 0, "settings": 0}

    # Sonarr
    for s in data.get("sonarr_servers", []):
        existing = (await db.execute(select(SonarrServer).where(SonarrServer.url == s["url"]))).scalar_one_or_none()
        if not existing:
            db.add(SonarrServer(name=s["name"], url=s["url"], api_key=_decrypt(s["api_key"]), enabled=s.get("enabled", True)))
            imported["sonarr"] += 1

    # Radarr
    for s in data.get("radarr_servers", []):
        existing = (await db.execute(select(RadarrServer).where(RadarrServer.url == s["url"]))).scalar_one_or_none()
        if not existing:
            db.add(RadarrServer(name=s["name"], url=s["url"], api_key=_decrypt(s["api_key"]), enabled=s.get("enabled", True)))
            imported["radarr"] += 1

    # Tautulli
    for s in data.get("tautulli_servers", []):
        existing = (await db.execute(select(TautulliServer).where(TautulliServer.url == s["url"]))).scalar_one_or_none()
        if not existing:
            db.add(TautulliServer(name=s["name"], url=s["url"], api_key=_decrypt(s["api_key"]), enabled=s.get("enabled", True)))
            imported["tautulli"] += 1

    # Plex
    for s in data.get("plex_servers", []):
        existing = (await db.execute(select(PlexServer).where(PlexServer.machine_id == s.get("machine_id")))).scalar_one_or_none() if s.get("machine_id") else None
        if not existing:
            db.add(PlexServer(name=s["name"], url=s["url"], token=_decrypt(s["token"]), machine_id=s.get("machine_id"), enabled=s.get("enabled", True)))
            imported["plex"] += 1

    # Jellyfin
    for s in data.get("jellyfin_servers", []):
        existing = (await db.execute(select(JellyfinServer).where(JellyfinServer.url == s["url"], JellyfinServer.user_id == s.get("user_id", user.id)))).scalar_one_or_none()
        if not existing:
            db.add(JellyfinServer(name=s["name"], url=s["url"], token=_decrypt(s["token"]), jellyfin_user_id=s["jellyfin_user_id"], jf_username=s.get("jf_username"), jf_password=_decrypt(s.get("jf_password")), user_id=s.get("user_id", user.id), enabled=s.get("enabled", True)))
            imported["jellyfin"] += 1

    # Download Profiles
    for p in data.get("download_profiles", []):
        existing = (await db.execute(select(DownloadProfile).where(DownloadProfile.name == p["name"]))).scalar_one_or_none()
        if not existing:
            db.add(DownloadProfile(name=p["name"], match_type=p["match_type"], server_type=p["server_type"], server_id=p["server_id"], quality_profile_id=p["quality_profile_id"], root_folder_path=p["root_folder_path"], monitor_strategy=p.get("monitor_strategy", "none"), auto_search=p.get("auto_search", False), enabled=p.get("enabled", True)))
            imported["profiles"] += 1

    # System Settings
    for s in data.get("system_settings", []):
        existing = (await db.execute(select(SystemSetting).where(SystemSetting.key == s["key"]))).scalar_one_or_none()
        if existing:
            existing.value = s["value"]
        else:
            db.add(SystemSetting(key=s["key"], value=s["value"]))
        imported["settings"] += 1

    await db.flush()
    return imported


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
