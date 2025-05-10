from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, Optional
from ..models import MediaSearchResponse
from ..utils import make_request, validate_token, require_feature
from ..config import BackendEndpoints, FeatureFlags

router = APIRouter(
    prefix="/media",
    tags=["Media"],
    dependencies=[require_feature(lambda: FeatureFlags.ENABLE_MEDIA_SEARCH)],
    responses={
        401: {"description": "Nicht autorisiert"},
        500: {"description": "Interner Serverfehler"}
    }
)

@router.get("/trending", response_model=MediaSearchResponse, summary="Trending-Medien",
            description="Ruft die aktuell angesagten Filme oder Serien ab.")
async def get_trending(
    type: str = Query("movie", description="Medientyp: 'movie' für Filme oder 'tv' für Serien"),
    payload: Dict[str, Any] = Depends(validate_token)
):
    """
    Ruft die derzeit angesagten Filme oder Serien ab.
    
    - **type**: Medientyp ('movie' für Filme oder 'tv' für Serien)
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt eine Liste der Trending-Filme oder -Serien zurück.
    """
    try:
        token = payload.get("token", "")
        response = await make_request(
            method="get",
            url=f"{BackendEndpoints.MEDIA_TRENDING}?type={type}",
            token=token
        )
        
        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Abrufen der Trending-Medien: {str(e)}")

@router.get("/upcoming", response_model=MediaSearchResponse, summary="Kommende Medien",
            description="Ruft kommende Filme oder Serien ab.")
async def get_upcoming(
    type: str = Query("movie", description="Medientyp: 'movie' für Filme oder 'tv' für Serien"),
    payload: Dict[str, Any] = Depends(validate_token)
):
    """
    Ruft kommende Filme oder Serien ab.
    
    - **type**: Medientyp ('movie' für Filme oder 'tv' für Serien)
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt eine Liste der kommenden Filme oder Serien zurück.
    """
    try:
        token = payload.get("token", "")
        response = await make_request(
            method="get",
            url=f"{BackendEndpoints.MEDIA_UPCOMING}?type={type}",
            token=token
        )
        
        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Abrufen der kommenden Medien: {str(e)}")

@router.get("/search", response_model=MediaSearchResponse, summary="Mediensuche",
            description="Sucht nach Filmen oder Serien basierend auf einem Suchbegriff.")
async def search_media(
    q: str = Query(..., description="Suchbegriff"),
    type: str = Query("movie", description="Medientyp: 'movie' für Filme oder 'tv' für Serien"),
    payload: Dict[str, Any] = Depends(validate_token)
):
    """
    Sucht nach Filmen oder Serien basierend auf einem Suchbegriff.
    
    - **q**: Suchbegriff
    - **type**: Medientyp ('movie' für Filme oder 'tv' für Serien)
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt eine Liste der gefundenen Filme oder Serien zurück.
    """
    try:
        token = payload.get("token", "")
        response = await make_request(
            method="get",
            url=f"{BackendEndpoints.MEDIA_SEARCH}?q={q}&type={type}",
            token=token
        )
        
        return response
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler bei der Mediensuche: {str(e)}") 