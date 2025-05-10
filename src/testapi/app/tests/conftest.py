import pytest
import os
import sys
from fastapi.testclient import TestClient
from app.main import app

# Sicherstellen, dass das Root-Verzeichnis im Pfad ist
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

@pytest.fixture
def client():
    """TestClient für die FastAPI-Anwendung"""
    with TestClient(app) as test_client:
        yield test_client 