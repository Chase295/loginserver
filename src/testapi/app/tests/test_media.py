from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.tests.test_watchlist import get_auth_headers

client = TestClient(app)

def test_get_trending():
    """Test des Abrufs von trendenden Filmen und Serien"""
    headers = get_auth_headers()
    
    # Test für Filme
    movie_response = client.get(
        "/api/media/trending?type=movie",
        headers=headers
    )
    
    assert movie_response.status_code == 200
    assert "results" in movie_response.json()
    assert isinstance(movie_response.json()["results"], list)
    
    # Test für Serien
    tv_response = client.get(
        "/api/media/trending?type=tv",
        headers=headers
    )
    
    assert tv_response.status_code == 200
    assert "results" in tv_response.json()
    assert isinstance(tv_response.json()["results"], list)

def test_get_upcoming():
    """Test des Abrufs von kommenden Filmen und Serien"""
    headers = get_auth_headers()
    
    # Test für Filme
    movie_response = client.get(
        "/api/media/upcoming?type=movie",
        headers=headers
    )
    
    assert movie_response.status_code == 200
    assert "results" in movie_response.json()
    assert isinstance(movie_response.json()["results"], list)
    
    # Test für Serien
    tv_response = client.get(
        "/api/media/upcoming?type=tv",
        headers=headers
    )
    
    assert tv_response.status_code == 200
    assert "results" in tv_response.json()
    assert isinstance(tv_response.json()["results"], list)

def test_search_media():
    """Test der Suchfunktion für Filme und Serien"""
    headers = get_auth_headers()
    
    # Test für Filme
    movie_response = client.get(
        "/api/media/search?q=star&type=movie",
        headers=headers
    )
    
    assert movie_response.status_code == 200
    assert "results" in movie_response.json()
    assert isinstance(movie_response.json()["results"], list)
    
    # Test für Serien
    tv_response = client.get(
        "/api/media/search?q=star&type=tv",
        headers=headers
    )
    
    assert tv_response.status_code == 200
    assert "results" in tv_response.json()
    assert isinstance(tv_response.json()["results"], list)
    
    # Test für leere Suchanfrage
    empty_response = client.get(
        "/api/media/search?q=&type=movie",
        headers=headers
    )
    
    assert empty_response.status_code == 200
    assert "results" in empty_response.json()
    assert len(empty_response.json()["results"]) == 0 