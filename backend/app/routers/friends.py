from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import Friend, User
from ..schemas import FriendLevelProposal, FriendOut, FriendRequest, FriendResponse

router = APIRouter(prefix="/api/friends", tags=["friends"])


@router.post("/request", status_code=201)
async def send_request(data: FriendRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    target = await db.execute(select(User).where(User.username == data.receiver_username))
    receiver = target.scalar_one_or_none()
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    if receiver.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    existing = await db.execute(
        select(Friend).where(
            or_(
                (Friend.sender_id == user.id) & (Friend.receiver_id == receiver.id),
                (Friend.sender_id == receiver.id) & (Friend.receiver_id == user.id),
            )
        )
    )
    old = existing.scalar_one_or_none()
    if old:
        if old.status == "rejected":
            # Allow re-sending after rejection
            await db.delete(old)
            await db.flush()
        else:
            raise HTTPException(status_code=409, detail="Friend request already exists")

    friend = Friend(sender_id=user.id, receiver_id=receiver.id)
    db.add(friend)
    return {"message": "Request sent"}


@router.get("/requests", response_model=list[dict])
async def get_requests(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Friend, User)
        .join(User, Friend.sender_id == User.id)
        .where(Friend.receiver_id == user.id, Friend.status == "pending")
    )
    return [
        {"id": f.id, "sender_id": f.sender_id, "sender_username": u.username, "created_at": str(f.created_at)}
        for f, u in result.all()
    ]


@router.get("/requests/sent", response_model=list[dict])
async def get_sent_requests(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Friend, User)
        .join(User, Friend.receiver_id == User.id)
        .where(Friend.sender_id == user.id, Friend.status.in_(["pending", "rejected"]))
    )
    return [
        {"id": f.id, "receiver_id": f.receiver_id, "receiver_username": u.username, "status": f.status, "created_at": str(f.created_at)}
        for f, u in result.all()
    ]


@router.delete("/request/{request_id}")
async def cancel_request(request_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Friend).where(Friend.id == request_id, Friend.sender_id == user.id))
    friend = result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404)
    await db.delete(friend)
    return {"message": "Request cancelled"}


@router.post("/respond")
async def respond_request(data: FriendResponse, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Friend).where(Friend.id == data.request_id, Friend.receiver_id == user.id))
    friend = result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404, detail="Request not found")

    friend.status = "accepted" if data.action == "accept" else "rejected"
    return {"message": f"Request {friend.status}"}


@router.get("/list", response_model=list[FriendOut])
async def list_friends(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Friend).where(
            Friend.status == "accepted",
            or_(Friend.sender_id == user.id, Friend.receiver_id == user.id),
        )
    )
    friends = result.scalars().all()

    out = []
    for f in friends:
        friend_user_id = f.receiver_id if f.sender_id == user.id else f.sender_id
        u = await db.execute(select(User).where(User.id == friend_user_id))
        friend_user = u.scalar_one()
        out.append(
            FriendOut(
                id=f.id,
                user_id=friend_user.id,
                username=friend_user.username,
                status=f.status,
                friendship_level=f.friendship_level,
                level_confirmed=f.level_confirmed,
                last_proposed_by=f.last_proposed_by,
            )
        )
    return out


@router.post("/level")
async def propose_level(data: FriendLevelProposal, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Friend).where(
            Friend.id == data.friend_id,
            Friend.status == "accepted",
            or_(Friend.sender_id == user.id, Friend.receiver_id == user.id),
        )
    )
    friend = result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404, detail="Friendship not found")

    if friend.friendship_level == data.level and friend.last_proposed_by != user.id:
        friend.level_confirmed = True
    else:
        friend.friendship_level = data.level
        friend.level_confirmed = False
        friend.last_proposed_by = user.id

    return {"message": "Level proposed", "confirmed": friend.level_confirmed}


@router.post("/delete")
async def delete_friend(data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    friend_id = data.get("friend_id")
    result = await db.execute(
        select(Friend).where(
            Friend.id == friend_id,
            or_(Friend.sender_id == user.id, Friend.receiver_id == user.id),
        )
    )
    friend = result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404)
    await db.delete(friend)
    return {"message": "Friend removed"}


@router.get("/users", response_model=list[dict])
async def list_users(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id != user.id).order_by(User.username))
    return [{"id": u.id, "username": u.username} for u in result.scalars().all()]
