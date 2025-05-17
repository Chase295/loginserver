from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.group_watchlist import GroupWatchlist, group_members
from models.user import User
from models.movie import Movie
from schemas.group_watchlist import GroupWatchlistCreate, GroupWatchlistResponse, GroupWatchlistUpdate
from schemas.user import UserResponse
from schemas.movie import MovieResponse
from auth import get_current_user

router = APIRouter(prefix="/api/watchlist/groups", tags=["group-watchlist"])

@router.post("", response_model=GroupWatchlistResponse)
def create_group(
    group_data: GroupWatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = GroupWatchlist(
        name=group_data.name,
        creator_id=current_user.id
    )
    group.members.append(current_user)  # Creator wird automatisch Mitglied
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.get("", response_model=List[GroupWatchlistResponse])
def get_user_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return current_user.group_watchlists

@router.get("/{group_id}", response_model=GroupWatchlistResponse)
def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if current_user not in group.members:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Gruppe")
    return group

@router.put("/{group_id}", response_model=GroupWatchlistResponse)
def update_group(
    group_id: int,
    group_data: GroupWatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann die Gruppe bearbeiten")
    
    group.name = group_data.name
    db.commit()
    db.refresh(group)
    return group

@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann die Gruppe löschen")
    
    db.delete(group)
    db.commit()
    return {"message": "Gruppe erfolgreich gelöscht"}

@router.get("/{group_id}/members", response_model=List[UserResponse])
def get_group_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Prüfe ob die Gruppe existiert
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")

    # Prüfe ob der aktuelle User Mitglied ist
    member = db.query(group_members).filter(
        group_members.c.group_id == group_id,
        group_members.c.user_id == current_user.id,
        group_members.c.status == 'accepted'
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Gruppe")

    # Hole nur akzeptierte Mitglieder
    accepted_members = db.query(User).join(
        group_members,
        User.id == group_members.c.user_id
    ).filter(
        group_members.c.group_id == group_id,
        group_members.c.status == 'accepted'
    ).all()

    return accepted_members

@router.post('/{group_id}/members')
def add_group_member(
    group_id: int,
    username: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Prüfe ob die Gruppe existiert
        group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
        
        # Prüfe ob der aktuelle User der Creator ist
        if group.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="Nur der Ersteller kann Mitglieder hinzufügen")
        
        # Finde den einzuladenden User
        new_member = db.query(User).filter(User.username == username).first()
        if not new_member:
            raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
        
        # Prüfe ob der User bereits Mitglied ist
        existing_member = db.execute(
            db.query(group_members).filter(
                group_members.c.group_id == group_id,
                group_members.c.user_id == new_member.id
            )
        ).first()
        
        if existing_member:
            if existing_member.status == 'accepted':
                raise HTTPException(status_code=400, detail="Benutzer ist bereits Mitglied")
            elif existing_member.status == 'pending':
                raise HTTPException(status_code=400, detail="Benutzer wurde bereits eingeladen")
        
        # Füge den User mit Status 'pending' hinzu
        db.execute(
            group_members.insert().values(
                group_id=group_id,
                user_id=new_member.id,
                status='pending'
            )
        )
        db.commit()
        
        return {"message": "Einladung erfolgreich gesendet"}
    except Exception as e:
        print(f"Fehler beim Hinzufügen des Mitglieds: {str(e)}")  # Debug-Ausgabe
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{group_id}/members/{user_id}")
def remove_group_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nur der Ersteller kann Mitglieder entfernen")
    
    member = db.query(User).filter(User.id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    if member not in group.members:
        raise HTTPException(status_code=400, detail="Benutzer ist kein Mitglied")
    if member.id == group.creator_id:
        raise HTTPException(status_code=400, detail="Der Ersteller kann nicht entfernt werden")
    
    group.members.remove(member)
    db.commit()
    return {"message": "Mitglied erfolgreich entfernt"}

@router.get("/{group_id}/movies", response_model=List[MovieResponse])
def get_group_movies(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if current_user not in group.members:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Gruppe")
    return group.movies

@router.post("/{group_id}/movies/{movie_id}")
def add_group_movie(
    group_id: int,
    movie_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if current_user not in group.members:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Gruppe")
    
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Film nicht gefunden")
    if movie in group.movies:
        raise HTTPException(status_code=400, detail="Film ist bereits in der Gruppen-Watchlist")
    
    group.movies.append(movie)
    db.commit()
    return {"message": "Film erfolgreich zur Gruppen-Watchlist hinzugefügt"}

@router.delete("/{group_id}/movies/{movie_id}")
def remove_group_movie(
    group_id: int,
    movie_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(GroupWatchlist).filter(GroupWatchlist.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if current_user not in group.members:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Gruppe")
    
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Film nicht gefunden")
    if movie not in group.movies:
        raise HTTPException(status_code=400, detail="Film ist nicht in der Gruppen-Watchlist")
    
    group.movies.remove(movie)
    db.commit()
    return {"message": "Film erfolgreich aus der Gruppen-Watchlist entfernt"} 