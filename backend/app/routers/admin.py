from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_admin
from ..database import get_db
from ..models import Movie, User, Watchlist

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


@router.get("/integrations")
async def get_integrations(user: User = Depends(require_admin)):
    """Placeholder for future Sonarr/Radarr/Plex integrations."""
    return {
        "sonarr": {"enabled": False, "url": None, "api_key": None},
        "radarr": {"enabled": False, "url": None, "api_key": None},
        "plex": {"enabled": False, "url": None, "token": None},
    }
