from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    watchlist_visibility = Column(String, default="public")  # public, private
    is_active = Column(Boolean, default=True)

    # Beziehungen
    watchlist = relationship("Movie", secondary="user_watchlist", back_populates="users")
    created_groups = relationship("GroupWatchlist", back_populates="creator", foreign_keys="[GroupWatchlist.creator_id]")
    group_watchlists = relationship("GroupWatchlist", secondary="group_members", back_populates="members") 