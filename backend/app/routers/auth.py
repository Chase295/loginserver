import logging

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import async_session, get_db
from ..models import Movie, PlexServer, User, Watchlist
from ..schemas import Token, UserLogin, UserOut, UserRegister
from ..services import plex as plex_service

logger = logging.getLogger(__name__)


async def _auto_setup_plex_user(user_id: int, plex_token: str):
    """Background: discover Plex servers + run full sync for new user."""
    logger.warning(f"Auto-setup STARTING for user {user_id}")
    try:
        async with async_session() as db:
            # 1. Discover all Plex servers
            discovered = await plex_service.discover_servers(plex_token)
            existing = {s.machine_id: s for s in (await db.execute(select(PlexServer))).scalars().all() if s.machine_id}

            added_servers = 0
            for srv in discovered:
                mid = srv["machine_id"]
                if mid in existing:
                    # Update token
                    if srv.get("token"):
                        existing[mid].token = srv["token"]
                    continue
                db.add(PlexServer(
                    name=srv["name"], url=srv["url"].rstrip("/"),
                    token=srv.get("token", plex_token),
                    machine_id=mid, enabled=True,
                ))
                added_servers += 1

            if added_servers > 0:
                await db.commit()
                logger.info(f"Auto-setup: discovered {added_servers} Plex servers for user {user_id}")

        # 2. Run full sync
        from ..routers.plex import _run_full_plex_sync
        await _run_full_plex_sync(user_id)
        logger.info(f"Auto-setup: full sync completed for user {user_id}")

    except Exception as e:
        logger.error(f"Auto-setup failed for user {user_id}: {e}")

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/login-options")
async def login_options(db: AsyncSession = Depends(get_db)):
    """Public endpoint: which login methods are available?"""
    from ..models import SystemSetting
    jf_url_setting = (await db.execute(select(SystemSetting).where(SystemSetting.key == "jellyfin_login_url"))).scalar_one_or_none()
    return {
        "plex": True,
        "jellyfin": bool(jf_url_setting),
        "jellyfin_url": jf_url_setting.value if jf_url_setting else None,
        "local": True,
    }

PLEX_HEADERS = {
    "X-Plex-Product": "Watchlist App",
    "X-Plex-Version": "2.0",
    "X-Plex-Client-Identifier": "watchlist-app-login",
    "Accept": "application/json",
}


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where((User.username == data.username) | (User.email == data.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username or email already exists")

    user = User(username=data.username, email=data.email, hashed_password=hash_password(data.password), auth_provider="local")
    db.add(user)
    await db.flush()

    watchlist = Watchlist(owner_id=user.id, name="Meine Watchlist", icon="🎬", is_default=True)
    db.add(watchlist)
    await db.flush()

    return Token(access_token=create_token(user.id, user.username))


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return Token(access_token=create_token(user.id, user.username))


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_installer": user.is_installer,
        "auth_provider": getattr(user, "auth_provider", "local"),
        "plex_username": user.plex_username,
        "plex_avatar": getattr(user, "plex_avatar", None),
        "last_tautulli_sync": str(user.last_tautulli_sync) if user.last_tautulli_sync else None,
        "created_at": str(user.created_at),
    }


# --- Plex OAuth (PIN-based) ---


@router.post("/plex/pin")
async def plex_create_pin():
    """Step 1: Create a Plex PIN for OAuth."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://plex.tv/api/v2/pins",
            headers=PLEX_HEADERS,
            data={"strong": "true"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "pin_id": data["id"],
            "code": data["code"],
            "auth_url": f"https://app.plex.tv/auth#!?clientID=watchlist-app-login&code={data['code']}&context%5Bdevice%5D%5Bproduct%5D=Watchlist%20App",
        }


@router.post("/plex/callback")
async def plex_callback(data: dict, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Step 2: Check if PIN was claimed, get token, login/register."""
    pin_id = data.get("pin_id")
    if not pin_id:
        raise HTTPException(status_code=400, detail="pin_id required")

    # Check PIN status
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://plex.tv/api/v2/pins/{pin_id}",
            headers=PLEX_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        pin_data = resp.json()

    auth_token = pin_data.get("authToken")
    if not auth_token:
        return {"status": "waiting"}

    # Get Plex user info
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://plex.tv/api/v2/user",
            headers={**PLEX_HEADERS, "X-Plex-Token": auth_token},
            timeout=10,
        )
        resp.raise_for_status()
        plex_user = resp.json()

    plex_id = str(plex_user.get("id", ""))
    plex_username = plex_user.get("username") or plex_user.get("title", "")
    plex_email = plex_user.get("email", "")
    plex_avatar = plex_user.get("thumb", "")

    if not plex_id:
        raise HTTPException(status_code=400, detail="Could not get Plex user info")

    # Find existing user by plex_id
    result = await db.execute(select(User).where(User.plex_id == plex_id))
    user = result.scalar_one_or_none()
    is_new = False

    if user:
        # Update token & avatar
        user.plex_token = auth_token
        user.plex_username = plex_username
        user.plex_avatar = plex_avatar
        await db.flush()
    else:
        is_new = True

        # Check if this is the FIRST user ever → becomes admin
        user_count = (await db.execute(select(func.count()).select_from(User))).scalar()
        is_first_user = user_count == 0

        # Check if username already taken
        username = plex_username
        result = await db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            username = f"{plex_username}_{plex_id[:4]}"

        # Check if email already taken
        email = plex_email or f"{plex_id}@plex.local"
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            email = f"plex_{plex_id}@plex.local"

        # Auto-register
        user = User(
            username=username,
            email=email,
            hashed_password=None,
            auth_provider="plex",
            is_admin=is_first_user,
            is_installer=is_first_user,
            plex_id=plex_id,
            plex_username=plex_username,
            plex_token=auth_token,
            plex_avatar=plex_avatar,
        )
        db.add(user)
        await db.flush()

        # Create default watchlist
        db.add(Watchlist(owner_id=user.id, name="Meine Watchlist", icon="🎬", is_default=True))
        await db.flush()

        if is_first_user:
            logger.warning(f"First user '{username}' registered via Plex — granted admin + installer")

    # Auto-create Tautulli connection if server exists
    if user.plex_username:
        from ..models import TautulliServer, UserPlexConnection
        tautulli_servers = (await db.execute(select(TautulliServer).where(TautulliServer.enabled == True))).scalars().all()
        for ts in tautulli_servers:
            existing_conn = (await db.execute(select(UserPlexConnection).where(UserPlexConnection.user_id == user.id, UserPlexConnection.server_id == ts.id))).scalar_one_or_none()
            if not existing_conn:
                db.add(UserPlexConnection(user_id=user.id, server_id=ts.id, plex_username=user.plex_username))
        await db.flush()

    # Trigger auto-setup for new users in background
    if is_new:
        import asyncio
        loop = asyncio.get_event_loop()
        loop.create_task(_auto_setup_plex_user(user.id, auth_token))

    return {
        "access_token": create_token(user.id, user.username),
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "plex_avatar": plex_avatar,
            "is_admin": user.is_admin,
        },
    }


@router.post("/plex/link")
async def plex_link(data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Link an existing local account with a Plex account."""
    pin_id = data.get("pin_id")
    if not pin_id:
        raise HTTPException(status_code=400, detail="pin_id required")

    # Check PIN
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://plex.tv/api/v2/pins/{pin_id}", headers=PLEX_HEADERS, timeout=10)
        resp.raise_for_status()
        pin_data = resp.json()

    auth_token = pin_data.get("authToken")
    if not auth_token:
        return {"status": "waiting"}

    # Get Plex user info
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://plex.tv/api/v2/user", headers={**PLEX_HEADERS, "X-Plex-Token": auth_token}, timeout=10)
        resp.raise_for_status()
        plex_user = resp.json()

    plex_id = str(plex_user.get("id", ""))
    plex_username = plex_user.get("username") or plex_user.get("title", "")
    plex_avatar = plex_user.get("thumb", "")

    # Check if this plex_id is already linked to another user
    existing = await db.execute(select(User).where(User.plex_id == plex_id, User.id != user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Dieser Plex-Account ist bereits mit einem anderen Benutzer verknüpft")

    # Link
    user.plex_id = plex_id
    user.plex_username = plex_username
    user.plex_token = auth_token
    user.plex_avatar = plex_avatar
    await db.flush()

    return {"status": "linked", "plex_username": plex_username}


# --- Jellyfin Login ---


@router.post("/jellyfin/login")
async def jellyfin_login(data: dict, db: AsyncSession = Depends(get_db)):
    """Login or register via Jellyfin credentials."""
    from ..models import JellyfinServer
    from ..services import jellyfin as jf_service

    jf_url = data.get("url", "").rstrip("/")
    jf_username = data.get("username", "")
    jf_password = data.get("password", "")

    if not jf_url or not jf_username or not jf_password:
        raise HTTPException(status_code=400, detail="URL, Username und Passwort erforderlich")

    # Authenticate with Jellyfin
    try:
        auth = await jf_service.authenticate(jf_url, jf_username, jf_password)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Jellyfin Login fehlgeschlagen: {e}")

    jf_user_id = auth["user_id"]
    jf_token = auth["token"]

    # Find existing user by jellyfin_id
    result = await db.execute(select(User).where(User.jellyfin_id == jf_user_id))
    user = result.scalar_one_or_none()
    is_new = False

    if user:
        # Update token
        user.jellyfin_username = jf_username
        await db.flush()
    else:
        is_new = True
        user_count = (await db.execute(select(func.count()).select_from(User))).scalar()
        is_first = user_count == 0

        # Check username conflict
        username = jf_username
        if (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
            username = f"{jf_username}_jf"

        email = f"{jf_user_id}@jellyfin.local"
        if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
            email = f"jf_{jf_user_id}@jellyfin.local"

        user = User(
            username=username, email=email, hashed_password=None,
            auth_provider="jellyfin",
            is_admin=is_first, is_installer=is_first,
            jellyfin_id=jf_user_id, jellyfin_username=jf_username,
        )
        db.add(user)
        await db.flush()

        # Create default watchlist
        db.add(Watchlist(owner_id=user.id, name="Meine Watchlist", icon="🎬", is_default=True))
        await db.flush()

        if is_first:
            logger.warning(f"First user '{username}' registered via Jellyfin — granted admin + installer")

    # Auto-add Jellyfin server for this user
    existing_jf = (await db.execute(select(JellyfinServer).where(JellyfinServer.user_id == user.id, JellyfinServer.url == jf_url))).scalar_one_or_none()
    if not existing_jf:
        try:
            info = await jf_service.test_connection(jf_url, jf_token, jf_user_id)
            server_name = info.get("name", "Jellyfin")
        except Exception:
            server_name = "Jellyfin"
        db.add(JellyfinServer(user_id=user.id, name=server_name, url=jf_url, token=jf_token, jellyfin_user_id=jf_user_id))
    else:
        existing_jf.token = jf_token
        existing_jf.jellyfin_user_id = jf_user_id
    await db.flush()

    # Commit before triggering sync (so sync can find the server)
    await db.commit()

    # Trigger full sync for new users or users with no movies
    should_sync = is_new
    if not should_sync:
        movie_count = (await db.execute(select(func.count()).select_from(Movie).join(Watchlist).where(Watchlist.owner_id == user.id))).scalar()
        should_sync = movie_count == 0

    if should_sync:
        import asyncio
        from ..routers.jellyfin import _run_jellyfin_sync
        asyncio.ensure_future(_run_jellyfin_sync(user.id))
        logger.warning(f"Jellyfin auto-sync started for user {user.username}")

    return {
        "access_token": create_token(user.id, user.username),
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "is_admin": user.is_admin},
    }
