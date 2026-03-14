from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .auth import hash_password
from .config import get_settings
from .database import Base, async_session, engine
from .models import User, Watchlist
from .routers import admin, auth, friends, groups, matches, media, watchlist

settings = get_settings()


async def _create_admin():
    """Create default admin user if not exists."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                username="admin",
                email="admin@watchlist.local",
                hashed_password=hash_password("admin123"),
                is_admin=True,
            )
            db.add(admin)
            await db.flush()
            db.add(Watchlist(owner_id=admin.id, name="Meine Watchlist", icon="🎬", is_default=True))
            await db.commit()
            print("✅ Admin user created (admin / admin123)")
        else:
            # Ensure existing admin has is_admin flag
            admin = result.scalar_one_or_none()
            if admin and not admin.is_admin:
                admin.is_admin = True
                await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _create_admin()
    yield
    await engine.dispose()


app = FastAPI(
    title="Watchlist API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(watchlist.router)
app.include_router(friends.router)
app.include_router(matches.router)
app.include_router(groups.router)
app.include_router(media.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
