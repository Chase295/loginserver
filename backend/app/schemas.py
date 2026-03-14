from datetime import datetime

from pydantic import BaseModel, EmailStr


# --- Auth ---
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime


# --- Movie / Watchlist ---
class TagSchema(BaseModel):
    label: str
    color: str = "#6366f1"
    is_private: bool = False


class MovieCreate(BaseModel):
    title: str
    year: str | None = None
    poster_url: str | None = None
    backdrop_path: str | None = None
    overview: str | None = None
    tmdb_id: int | None = None
    media_type: str | None = None
    vote_average: float | None = None
    genres: list | None = None
    status: str = "watchlist"
    rating: int | None = None
    notes: str | None = None
    tags: list[TagSchema] | None = []
    is_private: bool = False


class MovieUpdate(BaseModel):
    status: str | None = None
    rating: int | None = None
    notes: str | None = None
    tags: list[TagSchema] | None = None
    is_private: bool | None = None


class MovieOut(BaseModel):
    id: int
    title: str
    year: str | None
    poster_url: str | None
    backdrop_path: str | None
    overview: str | None
    tmdb_id: int | None
    media_type: str | None
    vote_average: float | None
    genres: list | None
    status: str
    rating: int | None
    notes: str | None
    tags: list | None
    is_private: bool
    created_at: datetime


class WatchlistSettings(BaseModel):
    visibility: str = "friends"


# --- Friends ---
class FriendRequest(BaseModel):
    receiver_username: str


class FriendResponse(BaseModel):
    request_id: int
    action: str  # accept / reject


class FriendLevelProposal(BaseModel):
    friend_id: int
    level: str


class FriendOut(BaseModel):
    id: int
    user_id: int
    username: str
    status: str
    friendship_level: str | None
    level_confirmed: bool
    last_proposed_by: int | None


# --- Matches ---
class MatchInviteCreate(BaseModel):
    receiver_id: int


class MatchInviteResponse(BaseModel):
    invitation_id: int
    action: str  # accept / reject


class MatchLikeCreate(BaseModel):
    movie_id: int
    liked: bool


class MatchPoolAdd(BaseModel):
    movie_ids: list[int]


class MatchOut(BaseModel):
    id: int
    player1_id: int
    player2_id: int
    player1_username: str | None = None
    player2_username: str | None = None
    status: str
    created_at: datetime


# --- Groups ---
class GroupCreate(BaseModel):
    name: str


class GroupInvite(BaseModel):
    username: str


class GroupOut(BaseModel):
    id: int
    name: str
    creator_id: int
    members: list[dict] = []
    created_at: datetime
