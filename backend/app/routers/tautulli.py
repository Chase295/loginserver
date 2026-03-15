import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import TautulliServer, User, UserPlexConnection
from ..schemas import TautulliServerCreate, TautulliServerUpdate
from ..services.tautulli import (
    check_plex_availability,
    get_user_history,
    sync_user_history,
    test_connection,
)

router = APIRouter(prefix="/api/tautulli", tags=["tautulli"])

PLEX_PRODUCT = "Watchlist App"
PLEX_PINS_URL = "https://plex.tv/api/v2/pins"
PLEX_USER_URL = "https://plex.tv/api/v2/user"


def _plex_headers(client_id: str) -> dict:
    return {
        "Accept": "application/json",
        "X-Plex-Product": PLEX_PRODUCT,
        "X-Plex-Client-Identifier": client_id,
    }


def _client_id_for_server(server_id: int) -> str:
    """Deterministic client ID per server so PINs work across restarts."""
    return f"watchlist-app-srv{server_id}"


# --- Admin: Server CRUD ---


@router.get("/servers")
async def list_servers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all Tautulli servers. Non-admin users get names + IDs only."""
    result = await db.execute(select(TautulliServer).order_by(TautulliServer.created_at))
    servers = result.scalars().all()
    if user.is_admin:
        return [
            {"id": s.id, "name": s.name, "url": s.url, "enabled": s.enabled, "created_at": str(s.created_at)}
            for s in servers
        ]
    return [{"id": s.id, "name": s.name, "enabled": s.enabled} for s in servers]


@router.post("/servers")
async def add_server(
    data: TautulliServerCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a new Tautulli server (admin only)."""
    server = TautulliServer(name=data.name, url=data.url.rstrip("/"), api_key=data.api_key)
    db.add(server)
    await db.flush()
    return {"id": server.id, "name": server.name, "url": server.url}


@router.put("/servers/{server_id}")
async def update_server(
    server_id: int,
    data: TautulliServerUpdate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a Tautulli server (admin only)."""
    result = await db.execute(select(TautulliServer).where(TautulliServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")
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
    """Delete a Tautulli server and all its connections (admin only)."""
    result = await db.execute(select(TautulliServer).where(TautulliServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")
    await db.delete(server)
    await db.flush()
    return {"status": "ok"}


@router.post("/servers/{server_id}/test")
async def test_server(
    server_id: int,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Test connection to a Tautulli server."""
    result = await db.execute(select(TautulliServer).where(TautulliServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")
    try:
        info = await test_connection(server.url, server.api_key)
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verbindung fehlgeschlagen: {e}")


# --- User: Plex Connections ---


@router.get("/connections")
async def list_connections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all Plex connections for the current user."""
    result = await db.execute(
        select(UserPlexConnection, TautulliServer)
        .join(TautulliServer)
        .where(UserPlexConnection.user_id == user.id)
    )
    rows = result.all()
    return [
        {
            "id": conn.id,
            "server_id": conn.server_id,
            "server_name": server.name,
            "plex_username": conn.plex_username,
            "last_sync": str(conn.last_sync) if conn.last_sync else None,
        }
        for conn, server in rows
    ]


@router.post("/servers/{server_id}/plex/pin")
async def create_plex_pin(
    server_id: int,
    forward_url: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Plex PIN for OAuth login for a specific server."""
    result = await db.execute(select(TautulliServer).where(TautulliServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")

    client_id = _client_id_for_server(server_id)
    headers = _plex_headers(client_id)

    async with httpx.AsyncClient() as client:
        resp = await client.post(PLEX_PINS_URL, headers=headers, data={"strong": "true"}, timeout=10)
        resp.raise_for_status()
        pin_data = resp.json()

    pin_id = pin_data["id"]
    code = pin_data["code"]
    auth_url = (
        f"https://app.plex.tv/auth#?clientID={client_id}"
        f"&code={code}"
        f"&context%5Bdevice%5D%5Bproduct%5D={PLEX_PRODUCT}"
    )
    if forward_url:
        auth_url += f"&forwardUrl={forward_url}"

    return {"pin_id": pin_id, "code": code, "auth_url": auth_url, "server_id": server_id}


@router.post("/servers/{server_id}/plex/callback")
async def plex_callback(
    server_id: int,
    pin_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Complete Plex auth for a specific server."""
    result = await db.execute(select(TautulliServer).where(TautulliServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server nicht gefunden")

    client_id = _client_id_for_server(server_id)
    headers = _plex_headers(client_id)

    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{PLEX_PINS_URL}/{pin_id}", headers=headers, timeout=10)
        resp.raise_for_status()
        pin_data = resp.json()

    auth_token = pin_data.get("authToken")
    if not auth_token:
        raise HTTPException(status_code=400, detail="Plex-Anmeldung noch nicht abgeschlossen")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            PLEX_USER_URL,
            headers={**headers, "X-Plex-Token": auth_token},
            timeout=10,
        )
        resp.raise_for_status()
        plex_user = resp.json()

    plex_username = plex_user.get("username") or plex_user.get("title")
    plex_id = str(plex_user.get("id", ""))

    if not plex_username:
        raise HTTPException(status_code=400, detail="Plex-Username konnte nicht ermittelt werden")

    # Check if connection already exists
    result = await db.execute(
        select(UserPlexConnection).where(
            UserPlexConnection.user_id == user.id,
            UserPlexConnection.server_id == server_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.plex_username = plex_username
        existing.plex_token = auth_token
        existing.plex_id = plex_id
    else:
        conn = UserPlexConnection(
            user_id=user.id,
            server_id=server_id,
            plex_username=plex_username,
            plex_token=auth_token,
            plex_id=plex_id,
        )
        db.add(conn)

    # Also keep the legacy fields on User for backward compat
    user.plex_username = plex_username
    user.plex_token = auth_token
    user.plex_id = plex_id
    await db.flush()

    return {"plex_username": plex_username, "server_name": server.name}


@router.delete("/connections/{connection_id}")
async def disconnect_plex(
    connection_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect a Plex connection."""
    result = await db.execute(
        select(UserPlexConnection).where(
            UserPlexConnection.id == connection_id,
            UserPlexConnection.user_id == user.id,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Verbindung nicht gefunden")
    await db.delete(conn)
    await db.flush()
    return {"status": "ok"}


# --- Sync ---


@router.post("/sync")
async def sync_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync history from all connected Tautulli servers for the current user."""
    result = await db.execute(
        select(UserPlexConnection, TautulliServer)
        .join(TautulliServer)
        .where(UserPlexConnection.user_id == user.id)
    )
    rows = result.all()

    if not rows:
        raise HTTPException(status_code=400, detail="Keine Plex-Verbindungen vorhanden")

    total_added = 0
    total_updated = 0
    total_entries = 0
    server_results = []

    for conn, server in rows:
        res = await sync_user_history(user, conn, server, db)
        server_results.append({"server": server.name, **res})
        if "error" not in res:
            total_added += res.get("added", 0)
            total_updated += res.get("updated", 0)
            total_entries += res.get("total_entries", 0)

    return {
        "added": total_added,
        "updated": total_updated,
        "total_entries": total_entries,
        "servers": server_results,
    }


# --- Stats & Availability ---


@router.get("/stats/{tmdb_id}")
async def get_movie_stats(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get Tautulli watch stats for a specific movie across all connected servers."""
    result = await db.execute(
        select(UserPlexConnection, TautulliServer)
        .join(TautulliServer)
        .where(UserPlexConnection.user_id == user.id)
    )
    rows = result.all()

    if not rows:
        return {"connected": False}

    for conn, server in rows:
        try:
            history = await get_user_history(server.url, server.api_key, conn.plex_username)
        except Exception:
            continue

        matching = []
        for entry in history:
            for guid in entry.get("guids") or []:
                val = guid if isinstance(guid, str) else str(guid)
                if f"tmdb://{tmdb_id}" in val:
                    matching.append(entry)
                    break

        if matching:
            latest = matching[0]
            return {
                "connected": True,
                "stats": {
                    "watch_count": len(matching),
                    "last_watched": latest.get("date"),
                    "last_platform": latest.get("platform"),
                    "last_player": latest.get("player"),
                    "server_name": server.name,
                },
            }

    return {"connected": True, "stats": None}


@router.get("/plex-available/{tmdb_id}")
async def check_available_on_plex(
    tmdb_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a title is available on any connected Plex server."""
    result = await db.execute(select(TautulliServer))
    servers = result.scalars().all()

    results = []
    for server in servers:
        try:
            info = await check_plex_availability(server.url, server.api_key, tmdb_id, server.id)
            if info and info.get("available"):
                results.append({
                    "available": True,
                    "library": info["library"],
                    "server_name": server.name,
                    "title": info.get("title"),
                })
        except Exception:
            continue

    if results:
        return {"available": True, "servers": results}
    return {"available": False}
