from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import Friend, Movie, User, Watchlist, WatchlistShare
from ..services.tmdb import TMDBService
from ..schemas import (
    MovieCreate,
    MovieOut,
    MovieUpdate,
    WatchlistCreate,
    WatchlistOut,
    WatchlistSettings,
    WatchlistShareCreate,
    WatchlistUpdate,
)

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


# --- Helper ---
async def get_or_create_default(user_id: int, db: AsyncSession) -> Watchlist:
    result = await db.execute(
        select(Watchlist).where(Watchlist.owner_id == user_id, Watchlist.is_default.is_(True))
    )
    wl = result.scalar_one_or_none()
    if not wl:
        wl = Watchlist(owner_id=user_id, name="Meine Watchlist", icon="🎬", is_default=True)
        db.add(wl)
        await db.flush()
    return wl


async def get_accessible_watchlist(watchlist_id: int, user_id: int, db: AsyncSession, need_edit: bool = False) -> Watchlist:
    """Get a watchlist if user owns it or has share access."""
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    if wl.owner_id == user_id:
        return wl

    share = await db.execute(
        select(WatchlistShare).where(WatchlistShare.watchlist_id == watchlist_id, WatchlistShare.user_id == user_id)
    )
    s = share.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=403, detail="No access")
    if need_edit and s.permission != "edit":
        raise HTTPException(status_code=403, detail="No edit permission")
    return wl


# --- Watchlist CRUD ---
@router.get("/lists", response_model=list[WatchlistOut])
async def get_my_watchlists(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Own watchlists
    result = await db.execute(
        select(Watchlist).where(Watchlist.owner_id == user.id).order_by(Watchlist.is_default.desc(), Watchlist.created_at)
    )
    own = result.scalars().all()

    # Shared with me
    shared_result = await db.execute(
        select(Watchlist)
        .join(WatchlistShare, WatchlistShare.watchlist_id == Watchlist.id)
        .where(WatchlistShare.user_id == user.id)
    )
    shared = shared_result.scalars().all()

    # Ensure default exists
    if not own:
        default = await get_or_create_default(user.id, db)
        own = [default]

    out = []
    for wl in list(own) + list(shared):
        count = await db.execute(select(func.count()).where(Movie.watchlist_id == wl.id))
        owner = await db.execute(select(User.username).where(User.id == wl.owner_id))

        shares = await db.execute(
            select(WatchlistShare, User).join(User, WatchlistShare.user_id == User.id).where(WatchlistShare.watchlist_id == wl.id)
        )
        shared_with = [{"user_id": s.user_id, "username": u.username, "permission": s.permission} for s, u in shares.all()]

        out.append(WatchlistOut(
            id=wl.id, name=wl.name, icon=wl.icon, owner_id=wl.owner_id,
            owner_username=owner.scalar(), visibility=wl.visibility,
            is_default=wl.is_default, movie_count=count.scalar(),
            shared_with=shared_with, created_at=wl.created_at,
        ))
    return out


@router.post("/lists", response_model=WatchlistOut, status_code=201)
async def create_watchlist(data: WatchlistCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = Watchlist(owner_id=user.id, name=data.name, icon=data.icon, visibility=data.visibility)
    db.add(wl)
    await db.flush()
    return WatchlistOut(
        id=wl.id, name=wl.name, icon=wl.icon, owner_id=wl.owner_id,
        owner_username=user.username, visibility=wl.visibility,
        is_default=False, created_at=wl.created_at,
    )


@router.put("/lists/{watchlist_id}", response_model=WatchlistOut)
async def update_watchlist(watchlist_id: int, data: WatchlistUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await get_accessible_watchlist(watchlist_id, user.id, db, need_edit=True)
    if wl.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only owner can update")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(wl, key, value)
    await db.flush()

    count = await db.execute(select(func.count()).where(Movie.watchlist_id == wl.id))
    return WatchlistOut(
        id=wl.id, name=wl.name, icon=wl.icon, owner_id=wl.owner_id,
        owner_username=user.username, visibility=wl.visibility,
        is_default=wl.is_default, movie_count=count.scalar(), created_at=wl.created_at,
    )


@router.delete("/lists/{watchlist_id}", status_code=204)
async def delete_watchlist(watchlist_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.owner_id == user.id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404)
    if wl.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default watchlist")
    await db.delete(wl)


# --- Sharing ---
@router.post("/lists/{watchlist_id}/share")
async def share_watchlist(watchlist_id: int, data: WatchlistShareCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.owner_id == user.id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404)

    target = await db.execute(select(User).where(User.username == data.username))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    existing = await db.execute(
        select(WatchlistShare).where(WatchlistShare.watchlist_id == watchlist_id, WatchlistShare.user_id == target_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already shared")

    db.add(WatchlistShare(watchlist_id=watchlist_id, user_id=target_user.id, permission=data.permission))
    return {"message": f"Shared with {data.username}"}


@router.delete("/lists/{watchlist_id}/share/{user_id}")
async def unshare_watchlist(watchlist_id: int, user_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.owner_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404)

    share = await db.execute(
        select(WatchlistShare).where(WatchlistShare.watchlist_id == watchlist_id, WatchlistShare.user_id == user_id)
    )
    s = share.scalar_one_or_none()
    if s:
        await db.delete(s)
    return {"message": "Unshared"}


# --- Movies ---
@router.get("/movies", response_model=list[MovieOut])
async def get_movies(
    watchlist_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if watchlist_id:
        wl = await get_accessible_watchlist(watchlist_id, user.id, db)
        result = await db.execute(
            select(Movie).where(Movie.watchlist_id == wl.id).order_by(Movie.created_at.desc())
        )
    else:
        # All movies from all owned + shared watchlists
        own_ids = await db.execute(select(Watchlist.id).where(Watchlist.owner_id == user.id))
        shared_ids = await db.execute(
            select(WatchlistShare.watchlist_id).where(WatchlistShare.user_id == user.id)
        )
        all_ids = [r for r in own_ids.scalars().all()] + [r for r in shared_ids.scalars().all()]
        if not all_ids:
            default = await get_or_create_default(user.id, db)
            all_ids = [default.id]

        result = await db.execute(
            select(Movie).where(Movie.watchlist_id.in_(all_ids)).order_by(Movie.created_at.desc())
        )

    return result.scalars().all()


@router.post("/movies", response_model=MovieOut, status_code=201)
async def add_movie(
    data: MovieCreate,
    watchlist_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if watchlist_id:
        wl = await get_accessible_watchlist(watchlist_id, user.id, db, need_edit=True)
    else:
        wl = await get_or_create_default(user.id, db)

    # Check for duplicate
    if data.tmdb_id:
        existing = await db.execute(
            select(Movie).where(
                Movie.watchlist_id == wl.id,
                Movie.tmdb_id == data.tmdb_id,
                Movie.media_type == data.media_type,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Movie already in watchlist")

    movie = Movie(watchlist_id=wl.id, **data.model_dump(mode="json"))
    db.add(movie)
    await db.flush()
    await db.refresh(movie)
    return movie


@router.put("/movies/{movie_id}", response_model=MovieOut)
async def update_movie(movie_id: int, data: MovieUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404)

    # Check access
    await get_accessible_watchlist(movie.watchlist_id, user.id, db, need_edit=True)

    for key, value in data.model_dump(exclude_unset=True, mode="json").items():
        setattr(movie, key, value)
    await db.flush()
    await db.refresh(movie)
    return movie


@router.post("/movies/{movie_id}/enrich", response_model=MovieOut)
async def enrich_movie(movie_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Fetch missing metadata from TMDB for a movie."""
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404)

    await get_accessible_watchlist(movie.watchlist_id, user.id, db)

    if not movie.tmdb_id or not movie.media_type:
        raise HTTPException(status_code=400, detail="No TMDB ID")

    tmdb = TMDBService()
    try:
        data = await tmdb.details(movie.media_type, movie.tmdb_id)
    except Exception:
        raise HTTPException(status_code=502, detail="TMDB fetch failed")

    if not movie.poster_url and data.get("poster_path"):
        movie.poster_url = data["poster_path"]
    if not movie.backdrop_path and data.get("backdrop_path"):
        movie.backdrop_path = data["backdrop_path"]
    if not movie.overview and data.get("overview"):
        movie.overview = data["overview"]
    if not movie.vote_average and data.get("vote_average"):
        movie.vote_average = data["vote_average"]
    if not movie.genres and data.get("genres"):
        movie.genres = [g["id"] for g in data["genres"]]
    if not movie.year:
        date = data.get("release_date") or data.get("first_air_date") or ""
        if date:
            movie.year = date[:4]

    await db.flush()
    await db.refresh(movie)
    return movie


@router.delete("/movies/{movie_id}", status_code=204)
async def delete_movie(movie_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404)

    await get_accessible_watchlist(movie.watchlist_id, user.id, db, need_edit=True)
    await db.delete(movie)


# --- Friend Watchlist View ---
@router.get("/user/{username}", response_model=list[MovieOut])
async def get_user_watchlist(username: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    target = await db.execute(select(User).where(User.username == username))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check friendship
    friendship = await db.execute(
        select(Friend).where(
            Friend.status == "accepted",
            or_(
                (Friend.sender_id == user.id) & (Friend.receiver_id == target_user.id),
                (Friend.sender_id == target_user.id) & (Friend.receiver_id == user.id),
            ),
        )
    )
    is_friend = friendship.scalar_one_or_none() is not None

    # Get all their watchlists based on visibility
    result = await db.execute(select(Watchlist).where(Watchlist.owner_id == target_user.id))
    watchlists = result.scalars().all()

    if target_user.id != user.id and not is_friend:
        # Non-friends can only see public watchlists
        has_public = any(wl.visibility == "public" for wl in watchlists)
        if not has_public:
            raise HTTPException(status_code=403, detail="Not friends")

    all_movies = []
    for wl in watchlists:
        if wl.visibility == "private" and target_user.id != user.id:
            continue
        if wl.visibility == "friends" and not is_friend and target_user.id != user.id:
            continue

        movies_result = await db.execute(
            select(Movie).where(Movie.watchlist_id == wl.id).order_by(Movie.created_at.desc())
        )
        movies = movies_result.scalars().all()

        if target_user.id != user.id:
            movies = [m for m in movies if not m.is_private]
            for movie in movies:
                if movie.tags:
                    movie.tags = [t for t in movie.tags if not t.get("is_private", False)]

        all_movies.extend(movies)

    return all_movies


# --- Legacy settings endpoint ---
@router.put("/settings", response_model=WatchlistSettings)
async def update_settings(data: WatchlistSettings, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await get_or_create_default(user.id, db)
    wl.visibility = data.visibility
    await db.flush()
    return WatchlistSettings(visibility=wl.visibility)


@router.get("/settings", response_model=WatchlistSettings)
async def get_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await get_or_create_default(user.id, db)
    return WatchlistSettings(visibility=wl.visibility)
