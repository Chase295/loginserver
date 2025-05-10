from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import PyJWTError
from app.config import settings
import requests
from functools import lru_cache

# OAuth2-Authentifizierungsschema
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

class BackendAPI:
    def __init__(self, base_url=settings.BACKEND_URL, timeout=settings.API_TIMEOUT):
        self.base_url = base_url
        self.timeout = timeout
        self.session = requests.Session()
    
    def get(self, endpoint, params=None, token=None):
        headers = self._prepare_headers(token)
        try:
            response = self.session.get(
                f"{self.base_url}{endpoint}", 
                params=params, 
                headers=headers, 
                timeout=self.timeout
            )
            return self._handle_response(response)
        except requests.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Backend-Service nicht erreichbar: {str(e)}"
            )
    
    def post(self, endpoint, data=None, token=None):
        headers = self._prepare_headers(token)
        try:
            response = self.session.post(
                f"{self.base_url}{endpoint}", 
                json=data, 
                headers=headers, 
                timeout=self.timeout
            )
            return self._handle_response(response)
        except requests.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Backend-Service nicht erreichbar: {str(e)}"
            )
    
    def delete(self, endpoint, token=None):
        headers = self._prepare_headers(token)
        try:
            response = self.session.delete(
                f"{self.base_url}{endpoint}", 
                headers=headers, 
                timeout=self.timeout
            )
            return self._handle_response(response)
        except requests.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Backend-Service nicht erreichbar: {str(e)}"
            )
    
    def _prepare_headers(self, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers
    
    def _handle_response(self, response):
        try:
            data = response.json()
        except ValueError:
            data = {"detail": response.text}
        
        if not response.ok:
            status_code = response.status_code
            detail = data.get("error", data.get("detail", "Unbekannter Fehler"))
            raise HTTPException(status_code=status_code, detail=detail)
        
        return data

@lru_cache()
def get_backend_api():
    """Dependency für den Backend-API-Client"""
    return BackendAPI()

async def get_current_user(token: str = Depends(oauth2_scheme), api: BackendAPI = Depends(get_backend_api)):
    try:
        # Token manuell validieren für Testzwecke
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("userId")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ungültiger Authentifizierungs-Token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"user_id": user_id, "token": token}
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Authentifizierungs-Token",
            headers={"WWW-Authenticate": "Bearer"},
        ) 