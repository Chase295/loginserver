from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    watchlist: Mapped["Watchlist"] = relationship(back_populates="user", uselist=False)


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    visibility: Mapped[str] = mapped_column(String(20), default="friends")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="watchlist")
    movies: Mapped[list["Movie"]] = relationship(back_populates="watchlist", cascade="all, delete-orphan")


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    watchlist_id: Mapped[int | None] = mapped_column(ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("group_watchlists.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    year: Mapped[str | None] = mapped_column(String(10))
    poster_url: Mapped[str | None] = mapped_column(Text)
    backdrop_path: Mapped[str | None] = mapped_column(Text)
    overview: Mapped[str | None] = mapped_column(Text)
    tmdb_id: Mapped[int | None] = mapped_column(Integer)
    media_type: Mapped[str | None] = mapped_column(String(20))
    vote_average: Mapped[float | None] = mapped_column(Float)
    genres: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), default="watchlist")
    rating: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list | None] = mapped_column(JSONB, default=[])
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    watchlist: Mapped["Watchlist"] = relationship(back_populates="movies")


class Friend(Base):
    __tablename__ = "friends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    receiver_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    friendship_level: Mapped[str | None] = mapped_column(String(50))
    level_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    last_proposed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    sender: Mapped["User"] = relationship(foreign_keys=[sender_id])
    receiver: Mapped["User"] = relationship(foreign_keys=[receiver_id])


class MatchInvitation(Base):
    __tablename__ = "match_invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    receiver_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    player1_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    player2_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="lobby")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    player1: Mapped["User"] = relationship(foreign_keys=[player1_id])
    player2: Mapped["User"] = relationship(foreign_keys=[player2_id])
    ready_status: Mapped[list["MatchReadyStatus"]] = relationship(back_populates="match", cascade="all, delete-orphan")
    pool: Mapped[list["MatchPool"]] = relationship(back_populates="match", cascade="all, delete-orphan")
    likes: Mapped[list["MatchLike"]] = relationship(back_populates="match", cascade="all, delete-orphan")


class MatchReadyStatus(Base):
    __tablename__ = "match_ready_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    player_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    is_ready: Mapped[bool] = mapped_column(Boolean, default=False)

    match: Mapped["Match"] = relationship(back_populates="ready_status")


class MatchPool(Base):
    __tablename__ = "match_pool"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    player_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"))

    match: Mapped["Match"] = relationship(back_populates="pool")
    movie: Mapped["Movie"] = relationship()


class MatchLike(Base):
    __tablename__ = "match_likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    player_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    movie_id: Mapped[int] = mapped_column(ForeignKey("movies.id", ondelete="CASCADE"))
    liked: Mapped[bool] = mapped_column(Boolean, default=False)

    match: Mapped["Match"] = relationship(back_populates="likes")


class GroupWatchlist(Base):
    __tablename__ = "group_watchlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    creator: Mapped["User"] = relationship()
    members: Mapped[list["GroupMember"]] = relationship(back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("group_watchlists.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    group: Mapped["GroupWatchlist"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()
