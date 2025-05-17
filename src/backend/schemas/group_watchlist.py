from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from .user import UserResponse
from .movie import MovieResponse

class GroupWatchlistBase(BaseModel):
    name: str

class GroupWatchlistCreate(GroupWatchlistBase):
    pass

class GroupWatchlistUpdate(GroupWatchlistBase):
    pass

class GroupWatchlistResponse(GroupWatchlistBase):
    id: int
    creator_id: int
    created_at: datetime
    updated_at: datetime
    creator_username: str

    class Config:
        from_attributes = True

class GroupWatchlistDetailResponse(GroupWatchlistResponse):
    members: List[UserResponse]
    movies: List[MovieResponse] 