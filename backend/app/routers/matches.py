from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import Match, MatchInvitation, MatchLike, MatchPool, MatchReadyStatus, Movie, User
from ..schemas import MatchInviteCreate, MatchInviteResponse, MatchLikeCreate, MatchOut, MatchPoolAdd

router = APIRouter(prefix="/api/match", tags=["matches"])


@router.post("/invite", status_code=201)
async def send_invite(data: MatchInviteCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
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
        match = Match(player1_id=inv.sender_id, player2_id=inv.receiver_id)
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
            Match.status.in_(["lobby", "playing"]),
            or_(Match.player1_id == user.id, Match.player2_id == user.id),
        )
    )
    matches = result.scalars().all()
    out = []
    for m in matches:
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
    result = await db.execute(select(Match).where(Match.id == match_id))
    m = result.scalar_one_or_none()
    if not m or (m.player1_id != user.id and m.player2_id != user.id):
        raise HTTPException(status_code=404)
    p1 = await db.execute(select(User.username).where(User.id == m.player1_id))
    p2 = await db.execute(select(User.username).where(User.id == m.player2_id))
    return MatchOut(
        id=m.id, player1_id=m.player1_id, player2_id=m.player2_id,
        player1_username=p1.scalar(), player2_username=p2.scalar(),
        status=m.status, created_at=m.created_at,
    )


@router.put("/{match_id}/status")
async def update_status(match_id: int, data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Match).where(Match.id == match_id))
    m = result.scalar_one_or_none()
    if not m or (m.player1_id != user.id and m.player2_id != user.id):
        raise HTTPException(status_code=404)
    m.status = data["status"]
    return {"status": m.status}


@router.post("/{match_id}/ready")
async def set_ready(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchReadyStatus).where(MatchReadyStatus.match_id == match_id, MatchReadyStatus.player_id == user.id)
    )
    ready = result.scalar_one_or_none()
    if ready:
        ready.is_ready = not ready.is_ready
    else:
        ready = MatchReadyStatus(match_id=match_id, player_id=user.id, is_ready=True)
        db.add(ready)
    await db.flush()

    all_ready = await db.execute(select(MatchReadyStatus).where(MatchReadyStatus.match_id == match_id))
    statuses = all_ready.scalars().all()
    both_ready = len(statuses) == 2 and all(s.is_ready for s in statuses)
    return {"is_ready": ready.is_ready, "both_ready": both_ready}


@router.post("/{match_id}/pool")
async def add_to_pool(match_id: int, data: MatchPoolAdd, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for movie_id in data.movie_ids:
        existing = await db.execute(
            select(MatchPool).where(
                MatchPool.match_id == match_id, MatchPool.player_id == user.id, MatchPool.movie_id == movie_id
            )
        )
        if not existing.scalar_one_or_none():
            db.add(MatchPool(match_id=match_id, player_id=user.id, movie_id=movie_id))
    return {"message": "Added to pool"}


@router.get("/{match_id}/pool")
async def get_pool(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MatchPool, Movie).join(Movie, MatchPool.movie_id == Movie.id).where(MatchPool.match_id == match_id)
    )
    return [
        {
            "id": mp.id, "player_id": mp.player_id,
            "movie": {"id": m.id, "title": m.title, "poster_url": m.poster_url, "tmdb_id": m.tmdb_id, "media_type": m.media_type},
        }
        for mp, m in result.all()
    ]


@router.post("/{match_id}/like")
async def like_movie(match_id: int, data: MatchLikeCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
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
    return {"message": "Vote recorded"}


@router.get("/{match_id}/matches")
async def get_matches(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Match).where(Match.id == match_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404)

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
            movies.append({"id": mv.id, "title": mv.title, "poster_url": mv.poster_url, "tmdb_id": mv.tmdb_id})
    return movies


@router.delete("/{match_id}")
async def delete_match(match_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Match).where(Match.id == match_id))
    m = result.scalar_one_or_none()
    if not m or (m.player1_id != user.id and m.player2_id != user.id):
        raise HTTPException(status_code=404)
    await db.delete(m)
    return {"message": "Match deleted"}
