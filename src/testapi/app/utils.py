import httpx
from fastapi import HTTPException, Depends, Header
from typing import Optional, Dict, Any, Callable
import jwt
import os
from .config import JWT_SECRET

async def make_request(
    method: str, 
    url: str, 
    json: Optional[Dict[str, Any]] = None, 
    token: Optional[str] = None, 
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Hilfsfunktion für HTTP-Anfragen an das Backend
    """
    if headers is None:
        headers = {}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    try:
        async with httpx.AsyncClient() as client:
            response = await getattr(client, method.lower())(
                url,
                json=json,
                headers=headers,
                timeout=30.0
            )
            
            # Bei Fehler eine entsprechende Exception werfen
            if not response.is_success:
                error_detail = "Interner Serverfehler"
                try:
                    error_json = response.json()
                    if "error" in error_json:
                        error_detail = error_json["error"]
                except:
                    error_detail = response.text or error_detail
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_detail
                )
                
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"HTTP-Fehler: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unerwarteter Fehler: {str(e)}")

async def validate_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Validiert den JWT-Token aus dem Authorization-Header
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Fehlender oder ungültiger Authorization-Header"
        )
    
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Ungültiger Token: {str(e)}"
        )

def require_feature(feature_flag: Callable[[], bool]):
    """
    Decorator/Dependency, um zu prüfen, ob ein Feature aktiviert ist
    """
    def dependency():
        if not feature_flag():
            raise HTTPException(
                status_code=404,
                detail="Dieses Feature ist derzeit nicht aktiviert"
            )
        return True
    
    return Depends(dependency) 