from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import Friend, Movie, User, Watchlist
from ..schemas import MovieCreate, MovieOut, MovieUpdate, WatchlistSettings

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("/movies", response_model=list[MovieOut])
async def get_my_movies(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await db.execute(select(Watchlist).where(Watchlist.user_id == user.id))
    watchlist = wl.scalar_one_or_none()
    if not watchlist:
        return []

    result = await db.execute(
        select(Movie).where(Movie.watchlist_id == watchlist.id).order_by(Movie.created_at.desc())
    )
    return result.scalars().all()


@router.post("/movies", response_model=MovieOut, status_code=201)
async def add_movie(data: MovieCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await db.execute(select(Watchlist).where(Watchlist.user_id == user.id))
    watchlist = wl.scalar_one_or_none()
    if not watchlist:
        watchlist = Watchlist(user_id=user.id)
        db.add(watchlist)
        await db.flush()

    # Check for duplicate
    if data.tmdb_id:
        existing = await db.execute(
            select(Movie).where(
                Movie.watchlist_id == watchlist.id,
                Movie.tmdb_id == data.tmdb_id,
                Movie.media_type == data.media_type,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Movie already in watchlist")

    movie = Movie(watchlist_id=watchlist.id, **data.model_dump(mode="json"))
    db.add(movie)
    await db.flush()
    await db.refresh(movie)
    return movie


@router.put("/movies/{movie_id}", response_model=MovieOut)
async def update_movie(
    movie_id: int, data: MovieUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    wl = await db.execute(select(Watchlist).where(Watchlist.user_id == user.id))
    watchlist = wl.scalar_one_or_none()
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    result = await db.execute(select(Movie).where(Movie.id == movie_id, Movie.watchlist_id == watchlist.id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    for key, value in data.model_dump(exclude_unset=True, mode="json").items():
        setattr(movie, key, value)

    await db.flush()
    await db.refresh(movie)
    return movie


@router.delete("/movies/{movie_id}", status_code=204)
async def delete_movie(movie_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await db.execute(select(Watchlist).where(Watchlist.user_id == user.id))
    watchlist = wl.scalar_one_or_none()
    if not watchlist:
        raise HTTPException(status_code=404)

    result = await db.execute(select(Movie).where(Movie.id == movie_id, Movie.watchlist_id == watchlist.id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404)

    await db.delete(movie)


@router.get("/user/{username}", response_model=list[MovieOut])
async def get_user_watchlist(
    username: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    target = await db.execute(select(User).where(User.username == username))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check friendship
    friendship = await db.execute(
        select(Friend).where(
            Friend.status == "accepted",
            (
                ((Friend.sender_id == user.id) & (Friend.receiver_id == target_user.id))
                | ((Friend.sender_id == target_user.id) & (Friend.receiver_id == user.id))
            ),
        )
    )
    is_friend = friendship.scalar_one_or_none() is not None

    wl = await db.execute(select(Watchlist).where(Watchlist.user_id == target_user.id))
    watchlist = wl.scalar_one_or_none()
    if not watchlist:
        return []

    # Check visibility
    if watchlist.visibility == "private" and target_user.id != user.id:
        raise HTTPException(status_code=403, detail="Watchlist is private")
    if watchlist.visibility == "friends" and not is_friend and target_user.id != user.id:
        raise HTTPException(status_code=403, detail="Not friends")

    result = await db.execute(
        select(Movie).where(Movie.watchlist_id == watchlist.id).order_by(Movie.created_at.desc())
    )
    movies = result.scalars().all()

    # Filter private content for non-owners
    if target_user.id != user.id:
        movies = [m for m in movies if not m.is_private]
        for movie in movies:
            if movie.tags:
                movie.tags = [t for t in movie.tags if not t.get("is_private", False)]

    return movies


@router.put("/settings", response_model=WatchlistSettings)
async def update_settings(
    data: WatchlistSettings, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    wl = await db.execute(select(Watchlist).where(Watchlist.user_id == user.id))
    watchlist = wl.scalar_one_or_none()
    if not watchlist:
        watchlist = Watchlist(user_id=user.id, visibility=data.visibility)
        db.add(watchlist)
    else:
        watchlist.visibility = data.visibility
    await db.flush()
    return WatchlistSettings(visibility=watchlist.visibility)


@router.get("/settings", response_model=WatchlistSettings)
async def get_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wl = await db.execute(select(Watchlist).where(Watchlist.user_id == user.id))
    watchlist = wl.scalar_one_or_none()
    if not watchlist:
        return WatchlistSettings()
    return WatchlistSettings(visibility=watchlist.visibility)
