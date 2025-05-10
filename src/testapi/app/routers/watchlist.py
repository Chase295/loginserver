from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from ..models import MovieCreate, MovieResponse, WatchlistResponse
from ..utils import make_request, validate_token, require_feature
from ..config import BackendEndpoints, FeatureFlags

router = APIRouter(
    prefix="/watchlist",
    tags=["Watchlist"],
    dependencies=[require_feature(lambda: FeatureFlags.ENABLE_WATCHLIST)],
    responses={
        401: {"description": "Nicht autorisiert"},
        404: {"description": "Nicht gefunden"},
        500: {"description": "Interner Serverfehler"}
    }
)

@router.post("", response_model=WatchlistResponse, summary="Watchlist erstellen",
             description="Erstellt eine Watchlist für den Benutzer, falls noch keine existiert.")
async def create_watchlist(payload: Dict[str, Any] = Depends(validate_token)):
    """
    Erstellt eine neue Watchlist für den authentifizierten Benutzer oder gibt die existierende zurück.
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt die Watchlist-ID zurück.
    """
    try:
        token = payload.get("token", "")
        response = await make_request(
            method="post",
            url=BackendEndpoints.WATCHLIST,
            token=token
        )
        
        return WatchlistResponse(
            message=response.get("message", "Watchlist erfolgreich erstellt"),
            watchlistId=response.get("watchlistId", 0)
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Erstellen der Watchlist: {str(e)}")

@router.get("/movies", response_model=List[MovieResponse], summary="Filme abrufen",
            description="Ruft alle Filme in der Watchlist des Benutzers ab.")
async def get_movies(payload: Dict[str, Any] = Depends(validate_token)):
    """
    Ruft alle Filme in der Watchlist des authentifizierten Benutzers ab.
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt eine Liste aller Filme in der Watchlist zurück.
    """
    try:
        token = payload.get("token", "")
        response = await make_request(
            method="get",
            url=BackendEndpoints.WATCHLIST_MOVIES,
            token=token
        )
        
        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Abrufen der Filme: {str(e)}")

@router.post("/movies", response_model=MovieResponse, summary="Film hinzufügen",
             description="Fügt einen Film zur Watchlist des Benutzers hinzu.")
async def add_movie(movie: MovieCreate, payload: Dict[str, Any] = Depends(validate_token)):
    """
    Fügt einen neuen Film zur Watchlist des authentifizierten Benutzers hinzu.
    
    - **title**: Titel des Films (erforderlich)
    - **year**: Erscheinungsjahr (optional)
    - **posterUrl**: URL zum Filmposter (optional)
    - **tmdb_id**: ID des Films in der TMDB (optional)
    - **media_type**: Typ des Mediums (movie/tv) (optional)
    - **backdrop_path**: Pfad zum Hintergrundbild (optional)
    - **overview**: Übersicht/Zusammenfassung (optional)
    - **vote_average**: Durchschnittliche Bewertung (optional)
    - **genres**: Genre-Informationen (optional)
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt den hinzugefügten Film mit ID zurück.
    """
    try:
        token = payload.get("token", "")
        response = await make_request(
            method="post",
            url=BackendEndpoints.WATCHLIST_MOVIES,
            json={
                "title": movie.title,
                "year": movie.year,
                "posterUrl": movie.posterUrl,
                "tmdb_id": movie.tmdb_id,
                "media_type": movie.media_type,
                "backdrop_path": movie.backdrop_path,
                "overview": movie.overview,
                "vote_average": movie.vote_average,
                "genres": movie.genres
            },
            token=token
        )
        
        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Hinzufügen des Films: {str(e)}")

@router.delete("/movies/{movie_id}", summary="Film löschen",
               description="Löscht einen Film aus der Watchlist des Benutzers.")
async def delete_movie(movie_id: int, payload: Dict[str, Any] = Depends(validate_token)):
    """
    Löscht einen Film aus der Watchlist des authentifizierten Benutzers.
    
    - **movie_id**: ID des zu löschenden Films
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt eine Erfolgsmeldung zurück.
    """
    try:
        token = payload.get("token", "")
        response = await make_request(
            method="delete",
            url=BackendEndpoints.WATCHLIST_MOVIE(movie_id),
            token=token
        )
        
        return {"message": "Film erfolgreich gelöscht"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Löschen des Films: {str(e)}") 