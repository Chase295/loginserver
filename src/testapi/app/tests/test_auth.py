from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.config import settings

client = TestClient(app)

def test_register():
    """Test der Registrierungsfunktion"""
    # Zufälligen Benutzernamen generieren, um Konflikte zu vermeiden
    import random
    import string
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    username = f"testuser_{random_suffix}"
    email = f"test_{random_suffix}@example.com"
    
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "testpassword123"
        }
    )
    
    assert response.status_code == 201
    assert "message" in response.json()
    assert "erfolgreich registriert" in response.json()["message"]

def test_login():
    """Test der Login-Funktion"""
    response = client.post(
        "/api/auth/login",
        json={
            "email": settings.TEST_EMAIL,
            "password": settings.TEST_PASSWORD
        }
    )
    
    assert response.status_code == 200
    assert "token" in response.json()
    assert "username" in response.json()
    
    # Token speichern für weitere Tests
    token = response.json()["token"]
    return token

def test_invalid_login():
    """Test eines ungültigen Logins"""
    response = client.post(
        "/api/auth/login",
        json={
            "email": "nicht@vorhanden.de",
            "password": "falschespasswort"
        }
    )
    
    assert response.status_code == 401  # Unauthorisiert

def test_token_validation():
    """Test der Token-Validierung"""
    # Zuerst einloggen und Token erhalten
    token = test_login()
    
    # Token-Validierungsendpunkt testen
    response = client.get(
        "/api/auth/test-token",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    assert "message" in response.json()
    assert "gültig" in response.json()["message"] 