from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import Match, MatchInvitation, MatchLike, MatchPool, Movie, User, Watchlist
from ..schemas import MatchInviteCreate, MatchInviteResponse, MatchLikeCreate, MatchOut, MatchPoolAdd

router = APIRouter(prefix="/api/match", tags=["matches"])


async def _get_match(match_id: int, user_id: int, db: AsyncSession) -> Match:
    result = await db.execute(select(Match).where(Match.id == match_id))
    m = result.scalar_one_or_none()
    if not m or (m.player1_id != user_id and m.player2_id != user_id):
        raise HTTPException(status_code=404)
    return m


@router.post("/invite", status_code=201)
async def send_invite(data: MatchInviteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if active match already exists with this person
    existing_match = await db.execute(
        select(Match).where(
            Match.status == "active",
            or_(
                (Match.player1_id == user.id) & (Match.player2_id == data.receiver_id),
                (Match.player1_id == data.receiver_id) & (Match.player2_id == user.id),
            ),
        )
    )
    if existing_match.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Active match already exists")

    inv = MatchInvitation(sender_id=user.id, receiver_id=data.receiver_id)
    db.add(inv)
    await db.flush()
    return {"id": inv.id, "message": "Invitation sent"}


@router.post("/invite/respond")
async def respond_invite(data: MatchInviteResponse, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchInvitation).where(MatchInvitation.id == data.invitation_id, MatchInvitation.receiver_id == user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404)

    if data.action == "accept":
        inv.status = "accepted"
        match = Match(player1_id=inv.sender_id, player2_id=inv.receiver_id, status="active")
        db.add(match)
        await db.flush()
        return {"match_id": match.id, "message": "Match created"}
    else:
        inv.status = "rejected"
        return {"message": "Invitation rejected"}


@router.delete("/invite/{invitation_id}")
async def cancel_invite(invitation_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchInvitation).where(MatchInvitation.id == invitation_id, MatchInvitation.sender_id == user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404)
    await db.delete(inv)
    return {"message": "Cancelled"}


@router.get("/invites/received", response_model=list[dict])
async def received_invites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchInvitation, User)
        .join(User, MatchInvitation.sender_id == User.id)
        .where(MatchInvitation.receiver_id == user.id, MatchInvitation.status == "pending")
    )
    return [{"id": inv.id, "sender_id": inv.sender_id, "sender_username": u.username} for inv, u in result.all()]


@router.get("/invites/sent", response_model=list[dict])
async def sent_invites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchInvitation, User)
        .join(User, MatchInvitation.receiver_id == User.id)
        .where(MatchInvitation.sender_id == user.id, MatchInvitation.status == "pending")
    )
    return [{"id": inv.id, "receiver_id": inv.receiver_id, "receiver_username": u.username} for inv, u in result.all()]


@router.get("/active", response_model=list[MatchOut])
async def active_matches(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Match).where(
            Match.status == "active",
            or_(Match.player1_id == user.id, Match.player2_id == user.id),
        )
    )
    matches = result.scalars().all()
    out = []
    for m in matches:
        p1 = await db.execute(select(User.username).where(User.id == m.player1_id))
        p2 = await db.execute(select(User.username).where(User.id == m.player2_id))

        # Count matches and pool
        common = await _count_common(m, db)
        pool_count = await db.execute(select(MatchPool.id).where(MatchPool.match_id == m.id))

        out.append(MatchOut(
            id=m.id, player1_id=m.player1_id, player2_id=m.player2_id,
            player1_username=p1.scalar(), player2_username=p2.scalar(),
            status=m.status, created_at=m.created_at,
        ))
    return out


async def _count_common(m: Match, db: AsyncSession) -> int:
    likes1 = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == m.id, MatchLike.player_id == m.player1_id, MatchLike.liked.is_(True))
    )
    likes2 = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == m.id, MatchLike.player_id == m.player2_id, MatchLike.liked.is_(True))
    )
    return len(set(likes1.scalars().all()) & set(likes2.scalars().all()))


@router.get("/{match_id}", response_model=MatchOut)
async def get_match(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _get_match(match_id, user.id, db)
    p1 = await db.execute(select(User.username).where(User.id == m.player1_id))
    p2 = await db.execute(select(User.username).where(User.id == m.player2_id))
    return MatchOut(
        id=m.id, player1_id=m.player1_id, player2_id=m.player2_id,
        player1_username=p1.scalar(), player2_username=p2.scalar(),
        status=m.status, created_at=m.created_at,
    )


@router.post("/{match_id}/pool")
async def add_to_pool(match_id: int, data: MatchPoolAdd, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_match(match_id, user.id, db)
    added = 0
    for movie_id in data.movie_ids:
        existing = await db.execute(
            select(MatchPool).where(MatchPool.match_id == match_id, MatchPool.movie_id == movie_id)
        )
        if not existing.scalar_one_or_none():
            db.add(MatchPool(match_id=match_id, player_id=user.id, movie_id=movie_id))
            added += 1
    return {"message": f"{added} added to pool"}


@router.delete("/{match_id}/pool/{movie_id}")
async def remove_from_pool(match_id: int, movie_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_match(match_id, user.id, db)
    result = await db.execute(
        select(MatchPool).where(MatchPool.match_id == match_id, MatchPool.movie_id == movie_id)
    )
    mp = result.scalar_one_or_none()
    if mp:
        await db.delete(mp)
        # Also remove likes for this movie
        likes = await db.execute(
            select(MatchLike).where(MatchLike.match_id == match_id, MatchLike.movie_id == movie_id)
        )
        for like in likes.scalars().all():
            await db.delete(like)
    return {"message": "Removed"}


@router.get("/{match_id}/pool")
async def get_pool(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_match(match_id, user.id, db)
    result = await db.execute(
        select(MatchPool, Movie).join(Movie, MatchPool.movie_id == Movie.id).where(MatchPool.match_id == match_id)
    )
    return [
        {
            "id": mp.id, "player_id": mp.player_id,
            "movie": {
                "id": m.id, "title": m.title, "poster_url": m.poster_url,
                "tmdb_id": m.tmdb_id, "media_type": m.media_type,
                "backdrop_path": m.backdrop_path, "overview": m.overview,
                "vote_average": m.vote_average, "year": m.year,
            },
        }
        for mp, m in result.all()
    ]


@router.get("/{match_id}/unswiped")
async def get_unswiped(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get movies in pool that this user hasn't voted on yet."""
    await _get_match(match_id, user.id, db)

    # All pool movie IDs
    pool = await db.execute(select(MatchPool.movie_id).where(MatchPool.match_id == match_id))
    pool_ids = set(pool.scalars().all())

    # Already voted
    voted = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == match_id, MatchLike.player_id == user.id)
    )
    voted_ids = set(voted.scalars().all())

    unswiped_ids = pool_ids - voted_ids
    if not unswiped_ids:
        return []

    result = await db.execute(select(Movie).where(Movie.id.in_(unswiped_ids)))
    movies = result.scalars().all()
    return [
        {
            "id": m.id, "title": m.title, "poster_url": m.poster_url,
            "backdrop_path": m.backdrop_path, "overview": m.overview,
            "tmdb_id": m.tmdb_id, "media_type": m.media_type,
            "vote_average": m.vote_average, "year": m.year,
        }
        for m in movies
    ]


@router.post("/{match_id}/like")
async def like_movie(match_id: int, data: MatchLikeCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_match(match_id, user.id, db)
    existing = await db.execute(
        select(MatchLike).where(
            MatchLike.match_id == match_id, MatchLike.player_id == user.id, MatchLike.movie_id == data.movie_id
        )
    )
    like = existing.scalar_one_or_none()
    if like:
        like.liked = data.liked
    else:
        db.add(MatchLike(match_id=match_id, player_id=user.id, movie_id=data.movie_id, liked=data.liked))

    # Check if this creates a new match
    m = await _get_match(match_id, user.id, db)
    other_id = m.player2_id if user.id == m.player1_id else m.player1_id
    if data.liked:
        other_like = await db.execute(
            select(MatchLike).where(
                MatchLike.match_id == match_id, MatchLike.player_id == other_id,
                MatchLike.movie_id == data.movie_id, MatchLike.liked.is_(True),
            )
        )
        if other_like.scalar_one_or_none():
            return {"message": "It's a match! 🎉", "is_match": True}

    return {"message": "Vote recorded", "is_match": False}


@router.get("/{match_id}/matches")
async def get_matches(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _get_match(match_id, user.id, db)

    likes1 = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == match_id, MatchLike.player_id == m.player1_id, MatchLike.liked.is_(True))
    )
    likes2 = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == match_id, MatchLike.player_id == m.player2_id, MatchLike.liked.is_(True))
    )
    common = set(likes1.scalars().all()) & set(likes2.scalars().all())

    movies = []
    for mid in common:
        r = await db.execute(select(Movie).where(Movie.id == mid))
        mv = r.scalar_one_or_none()
        if mv:
            movies.append({"id": mv.id, "title": mv.title, "poster_url": mv.poster_url, "tmdb_id": mv.tmdb_id, "year": mv.year})
    return movies


@router.get("/{match_id}/stats")
async def get_stats(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _get_match(match_id, user.id, db)

    pool_count = await db.execute(select(MatchPool.id).where(MatchPool.match_id == match_id))
    pool_total = len(pool_count.scalars().all())

    my_votes = await db.execute(
        select(MatchLike.id).where(MatchLike.match_id == match_id, MatchLike.player_id == user.id)
    )
    other_id = m.player2_id if user.id == m.player1_id else m.player1_id
    other_votes = await db.execute(
        select(MatchLike.id).where(MatchLike.match_id == match_id, MatchLike.player_id == other_id)
    )
    common_count = await _count_common(m, db)

    return {
        "pool_total": pool_total,
        "my_votes": len(my_votes.scalars().all()),
        "other_votes": len(other_votes.scalars().all()),
        "matches": common_count,
    }


@router.delete("/{match_id}")
async def delete_match(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _get_match(match_id, user.id, db)
    await db.delete(m)
    return {"message": "Match deleted"}
