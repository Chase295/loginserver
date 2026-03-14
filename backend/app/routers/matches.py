from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import Match, MatchInvitation, MatchLike, MatchPoolLink, Movie, User, Watchlist
from ..schemas import MatchInviteCreate, MatchInviteResponse, MatchLikeCreate, MatchOut

router = APIRouter(prefix="/api/match", tags=["matches"])


async def _get_match(match_id: int, user_id: int, db: AsyncSession) -> Match:
    result = await db.execute(select(Match).where(Match.id == match_id))
    m = result.scalar_one_or_none()
    if not m or (m.player1_id != user_id and m.player2_id != user_id):
        raise HTTPException(status_code=404)
    return m


async def _get_pool_movie_ids(match_id: int, db: AsyncSession) -> set[int]:
    """Dynamically compute pool from all linked watchlists minus excludes."""
    links = await db.execute(select(MatchPoolLink).where(MatchPoolLink.match_id == match_id))
    all_ids = set()
    for link in links.scalars().all():
        movies = await db.execute(select(Movie.id).where(Movie.watchlist_id == link.watchlist_id))
        movie_ids = set(movies.scalars().all())
        excludes = set(link.excludes or [])
        all_ids |= (movie_ids - excludes)
    return all_ids


# --- Invites ---
@router.post("/invite", status_code=201)
async def send_invite(data: MatchInviteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Match).where(
            Match.status == "active",
            or_(
                (Match.player1_id == user.id) & (Match.player2_id == data.receiver_id),
                (Match.player1_id == data.receiver_id) & (Match.player2_id == user.id),
            ),
        )
    )
    if existing.scalar_one_or_none():
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


@router.get("/invites/received")
async def received_invites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchInvitation, User)
        .join(User, MatchInvitation.sender_id == User.id)
        .where(MatchInvitation.receiver_id == user.id, MatchInvitation.status == "pending")
    )
    return [{"id": inv.id, "sender_id": inv.sender_id, "sender_username": u.username} for inv, u in result.all()]


@router.get("/invites/sent")
async def sent_invites(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchInvitation, User)
        .join(User, MatchInvitation.receiver_id == User.id)
        .where(MatchInvitation.sender_id == user.id, MatchInvitation.status == "pending")
    )
    return [{"id": inv.id, "receiver_id": inv.receiver_id, "receiver_username": u.username} for inv, u in result.all()]


# --- Active Matches ---
@router.get("/active", response_model=list[MatchOut])
async def active_matches(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Match).where(
            Match.status == "active",
            or_(Match.player1_id == user.id, Match.player2_id == user.id),
        )
    )
    out = []
    for m in result.scalars().all():
        p1 = await db.execute(select(User.username).where(User.id == m.player1_id))
        p2 = await db.execute(select(User.username).where(User.id == m.player2_id))
        out.append(MatchOut(
            id=m.id, player1_id=m.player1_id, player2_id=m.player2_id,
            player1_username=p1.scalar(), player2_username=p2.scalar(),
            status=m.status, created_at=m.created_at,
        ))
    return out


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


# --- Pool Links (Watchlists) ---
@router.get("/{match_id}/links")
async def get_links(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all linked watchlists for this match."""
    await _get_match(match_id, user.id, db)
    links = await db.execute(
        select(MatchPoolLink, Watchlist)
        .join(Watchlist, MatchPoolLink.watchlist_id == Watchlist.id)
        .where(MatchPoolLink.match_id == match_id)
    )
    return [
        {
            "id": link.id,
            "watchlist_id": link.watchlist_id,
            "watchlist_name": wl.name,
            "watchlist_icon": wl.icon,
            "user_id": link.user_id,
            "excludes": link.excludes or [],
        }
        for link, wl in links.all()
    ]


@router.post("/{match_id}/links")
async def link_watchlist(match_id: int, data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Link a watchlist to the match pool."""
    await _get_match(match_id, user.id, db)
    wl_id = data["watchlist_id"]

    existing = await db.execute(
        select(MatchPoolLink).where(MatchPoolLink.match_id == match_id, MatchPoolLink.watchlist_id == wl_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already linked")

    db.add(MatchPoolLink(match_id=match_id, watchlist_id=wl_id, user_id=user.id))
    return {"message": "Watchlist linked"}


@router.delete("/{match_id}/links/{watchlist_id}")
async def unlink_watchlist(match_id: int, watchlist_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_match(match_id, user.id, db)
    result = await db.execute(
        select(MatchPoolLink).where(MatchPoolLink.match_id == match_id, MatchPoolLink.watchlist_id == watchlist_id)
    )
    link = result.scalar_one_or_none()
    if link:
        await db.delete(link)
    return {"message": "Unlinked"}


@router.put("/{match_id}/links/{watchlist_id}/exclude")
async def toggle_exclude(match_id: int, watchlist_id: int, data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Toggle a movie exclusion. data: {movie_id: int}"""
    await _get_match(match_id, user.id, db)
    result = await db.execute(
        select(MatchPoolLink).where(MatchPoolLink.match_id == match_id, MatchPoolLink.watchlist_id == watchlist_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404)

    movie_id = data["movie_id"]
    excludes = list(link.excludes or [])
    if movie_id in excludes:
        excludes.remove(movie_id)
    else:
        excludes.append(movie_id)
    link.excludes = excludes
    await db.flush()
    return {"excludes": link.excludes}


# --- Dynamic Pool ---
@router.get("/{match_id}/pool")
async def get_pool(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_match(match_id, user.id, db)
    pool_ids = await _get_pool_movie_ids(match_id, db)
    if not pool_ids:
        return []
    result = await db.execute(select(Movie).where(Movie.id.in_(pool_ids)))
    return [
        {
            "id": m.id, "title": m.title, "poster_url": m.poster_url,
            "tmdb_id": m.tmdb_id, "media_type": m.media_type,
            "backdrop_path": m.backdrop_path, "overview": m.overview,
            "vote_average": m.vote_average, "year": m.year,
        }
        for m in result.scalars().all()
    ]


@router.get("/{match_id}/unswiped")
async def get_unswiped(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_match(match_id, user.id, db)
    pool_ids = await _get_pool_movie_ids(match_id, db)

    voted = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == match_id, MatchLike.player_id == user.id)
    )
    voted_ids = set(voted.scalars().all())
    unswiped_ids = pool_ids - voted_ids
    if not unswiped_ids:
        return []

    result = await db.execute(select(Movie).where(Movie.id.in_(unswiped_ids)))
    return [
        {
            "id": m.id, "title": m.title, "poster_url": m.poster_url,
            "backdrop_path": m.backdrop_path, "overview": m.overview,
            "tmdb_id": m.tmdb_id, "media_type": m.media_type,
            "vote_average": m.vote_average, "year": m.year,
        }
        for m in result.scalars().all()
    ]


# --- Voting ---
@router.post("/{match_id}/like")
async def like_movie(match_id: int, data: MatchLikeCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _get_match(match_id, user.id, db)
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

    if data.liked:
        other_id = m.player2_id if user.id == m.player1_id else m.player1_id
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
    if not common:
        return []

    result = await db.execute(select(Movie).where(Movie.id.in_(common)))
    return [
        {"id": mv.id, "title": mv.title, "poster_url": mv.poster_url, "tmdb_id": mv.tmdb_id, "year": mv.year}
        for mv in result.scalars().all()
    ]


@router.get("/{match_id}/stats")
async def get_stats(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _get_match(match_id, user.id, db)
    pool_ids = await _get_pool_movie_ids(match_id, db)

    my_votes = await db.execute(
        select(MatchLike.id).where(MatchLike.match_id == match_id, MatchLike.player_id == user.id)
    )
    other_id = m.player2_id if user.id == m.player1_id else m.player1_id
    other_votes = await db.execute(
        select(MatchLike.id).where(MatchLike.match_id == match_id, MatchLike.player_id == other_id)
    )

    likes1 = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == match_id, MatchLike.player_id == m.player1_id, MatchLike.liked.is_(True))
    )
    likes2 = await db.execute(
        select(MatchLike.movie_id).where(MatchLike.match_id == match_id, MatchLike.player_id == m.player2_id, MatchLike.liked.is_(True))
    )
    common = len(set(likes1.scalars().all()) & set(likes2.scalars().all()))

    return {
        "pool_total": len(pool_ids),
        "my_votes": len(my_votes.scalars().all()),
        "other_votes": len(other_votes.scalars().all()),
        "matches": common,
    }


@router.delete("/{match_id}")
async def delete_match(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = await _get_match(match_id, user.id, db)
    await db.delete(m)
    return {"message": "Match deleted"}
