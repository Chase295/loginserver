from fastapi import APIRouter, HTTPException, Depends
from ..models import RegisterRequest, LoginRequest, TokenResponse, UserProfile
from ..utils import make_request, validate_token
from ..config import BackendEndpoints
from typing import Dict, Any

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
    responses={
        401: {"description": "Nicht autorisiert"},
        400: {"description": "Ungültige Eingabe"},
        500: {"description": "Interner Serverfehler"}
    }
)

@router.post("/register", response_model=TokenResponse, summary="Benutzer registrieren", 
             description="Registriert einen neuen Benutzer mit Benutzername, E-Mail und Passwort.")
async def register(data: RegisterRequest):
    """
    Registriert einen neuen Benutzer und gibt ein JWT-Token zurück.
    
    - **username**: Benutzername (muss eindeutig sein)
    - **email**: E-Mail-Adresse (muss eindeutig sein)
    - **password**: Passwort (mindestens 6 Zeichen)
    
    Gibt bei Erfolg ein JWT-Token zurück, das für die Authentifizierung verwendet werden kann.
    """
    try:
        response = await make_request(
            method="post",
            url=BackendEndpoints.AUTH_REGISTER,
            json={
                "username": data.username,
                "email": data.email,
                "password": data.password
            }
        )
        
        # Da die Registrierung erfolgreich war, führen wir automatisch den Login durch
        login_response = await make_request(
            method="post",
            url=BackendEndpoints.AUTH_LOGIN,
            json={
                "email": data.email,
                "password": data.password
            }
        )
        
        return TokenResponse(
            token=login_response.get("token", ""),
            username=login_response.get("username", "")
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registrierung fehlgeschlagen: {str(e)}")

@router.post("/login", response_model=TokenResponse, summary="Benutzer anmelden",
             description="Meldet einen Benutzer mit E-Mail und Passwort an.")
async def login(data: LoginRequest):
    """
    Meldet einen bestehenden Benutzer an und gibt ein JWT-Token zurück.
    
    - **email**: E-Mail-Adresse des Benutzers
    - **password**: Passwort des Benutzers
    
    Gibt bei Erfolg ein JWT-Token zurück, das für die Authentifizierung verwendet werden kann.
    """
    try:
        response = await make_request(
            method="post",
            url=BackendEndpoints.AUTH_LOGIN,
            json={
                "email": data.email,
                "password": data.password
            }
        )
        
        return TokenResponse(
            token=response.get("token", ""),
            username=response.get("username", "")
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login fehlgeschlagen: {str(e)}")

@router.get("/verify", summary="Token validieren",
            description="Validiert ein JWT-Token und gibt den Benutzer zurück.")
async def verify_token(payload: Dict[str, Any] = Depends(validate_token)):
    """
    Validiert ein JWT-Token und gibt Informationen zum Benutzer zurück.
    
    Das Token muss im Authorization-Header als Bearer-Token gesendet werden:
    ```
    Authorization: Bearer <token>
    ```
    
    Gibt bei Erfolg die im Token enthaltenen Benutzerinformationen zurück.
    """
    try:
        return {
            "userId": payload.get("userId"),
            "email": payload.get("email"),
            "exp": payload.get("exp"),
            "valid": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token-Validierung fehlgeschlagen: {str(e)}")
 