from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.tests.test_auth import test_login

client = TestClient(app)

def get_auth_headers():
    """Authentifizierungs-Header für Tests"""
    token = test_login()
    return {"Authorization": f"Bearer {token}"}

def test_create_watchlist():
    """Test der Watchlist-Erstellung"""
    headers = get_auth_headers()
    
    response = client.post(
        "/api/watchlist",
        headers=headers
    )
    
    assert response.status_code in [200, 201]  # Entweder neu erstellt oder bereits vorhanden
    assert "watchlistId" in response.json()
    
    return response.json()["watchlistId"]

def test_get_watchlist_movies():
    """Test des Abrufs von Watchlist-Filmen"""
    headers = get_auth_headers()
    
    # Sicherstellen, dass eine Watchlist existiert
    test_create_watchlist()
    
    response = client.get(
        "/api/watchlist/movies",
        headers=headers
    )
    
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_add_and_delete_movie():
    """Test des Hinzufügens und Löschens eines Films"""
    headers = get_auth_headers()
    
    # Film hinzufügen
    movie_data = {
        "title": "Test Movie",
        "year": 2023,
        "poster_url": "https://example.com/poster.jpg"
    }
    
    add_response = client.post(
        "/api/watchlist/movies",
        json=movie_data,
        headers=headers
    )
    
    assert add_response.status_code == 201
    assert "id" in add_response.json()
    assert add_response.json()["title"] == movie_data["title"]
    
    movie_id = add_response.json()["id"]
    
    # Film löschen
    delete_response = client.delete(
        f"/api/watchlist/movies/{movie_id}",
        headers=headers
    )
    
    assert delete_response.status_code == 200
    assert "message" in delete_response.json()
    assert "erfolgreich gelöscht" in delete_response.json()["message"] 