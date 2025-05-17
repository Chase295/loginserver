from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# Verbindungstabelle für Gruppen-Mitglieder
group_members = Table(
    'group_members',
    Base.metadata,
    Column('group_id', Integer, ForeignKey('group_watchlists.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('status', String(20), default='accepted'),
    Column('created_at', DateTime, default=datetime.utcnow)
)

# Verbindungstabelle für Gruppen-Filme
group_movies = Table(
    'group_movies',
    Base.metadata,
    Column('group_id', Integer, ForeignKey('group_watchlists.id'), primary_key=True),
    Column('movie_id', Integer, ForeignKey('movies.id'), primary_key=True)
)

class GroupWatchlist(Base):
    __tablename__ = 'group_watchlists'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    creator_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Beziehungen
    creator = relationship("User", back_populates="created_groups", foreign_keys=[creator_id])
    members = relationship("User", secondary=group_members, backref="group_watchlists")
    movies = relationship("Movie", secondary=group_movies, backref="group_watchlists") 