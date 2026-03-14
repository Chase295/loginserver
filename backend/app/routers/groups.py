from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import GroupMember, GroupWatchlist, Movie, User
from ..schemas import GroupCreate, GroupInvite, GroupOut, MovieCreate, MovieOut

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.post("/", response_model=GroupOut, status_code=201)
async def create_group(data: GroupCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = GroupWatchlist(name=data.name, creator_id=user.id)
    db.add(group)
    await db.flush()

    member = GroupMember(group_id=group.id, user_id=user.id, status="accepted")
    db.add(member)
    await db.flush()

    return GroupOut(id=group.id, name=group.name, creator_id=group.creator_id, created_at=group.created_at)


@router.get("/", response_model=list[GroupOut])
async def my_groups(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GroupWatchlist)
        .join(GroupMember, GroupMember.group_id == GroupWatchlist.id)
        .where(GroupMember.user_id == user.id, GroupMember.status == "accepted")
    )
    groups = result.scalars().all()
    out = []
    for g in groups:
        members_result = await db.execute(
            select(GroupMember, User).join(User, GroupMember.user_id == User.id).where(GroupMember.group_id == g.id)
        )
        members = [{"user_id": m.user_id, "username": u.username, "status": m.status} for m, u in members_result.all()]
        out.append(GroupOut(id=g.id, name=g.name, creator_id=g.creator_id, members=members, created_at=g.created_at))
    return out


@router.post("/{group_id}/invite")
async def invite_member(group_id: int, data: GroupInvite, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    target = await db.execute(select(User).where(User.username == data.username))
    target_user = target.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == target_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already member or invited")

    db.add(GroupMember(group_id=group_id, user_id=target_user.id))
    return {"message": "Invited"}


@router.post("/{group_id}/respond")
async def respond_invite(group_id: int, data: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user.id, GroupMember.status == "pending")
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404)

    if data.get("action") == "accept":
        member.status = "accepted"
    else:
        await db.delete(member)
    return {"message": "Done"}


@router.get("/{group_id}/movies", response_model=list[MovieOut])
async def get_group_movies(group_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify membership
    member = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user.id, GroupMember.status == "accepted")
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403)

    result = await db.execute(select(Movie).where(Movie.group_id == group_id).order_by(Movie.created_at.desc()))
    return result.scalars().all()


@router.post("/{group_id}/movies", response_model=MovieOut, status_code=201)
async def add_group_movie(group_id: int, data: MovieCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    member = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user.id, GroupMember.status == "accepted")
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403)

    movie = Movie(group_id=group_id, **data.model_dump(mode="json"))
    db.add(movie)
    await db.flush()
    await db.refresh(movie)
    return movie
