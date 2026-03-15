from ..database import async_session
from ..models import SyncLog


async def log_sync(user_id: int, source: str, direction: str, added: int = 0, updated: int = 0, errors: int = 0, details: str = ""):
    """Log a sync event."""
    try:
        async with async_session() as db:
            db.add(SyncLog(user_id=user_id, source=source, direction=direction, added=added, updated=updated, errors=errors, details=details or None))
            await db.commit()
    except Exception:
        pass
