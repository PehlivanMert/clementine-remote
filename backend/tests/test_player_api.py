import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings

client = TestClient(app)

@pytest.fixture
def auth_headers():
    res = client.post("/api/auth/login", json={"password": settings.WEB_PASSWORD})
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_player_endpoints(auth_headers):
    # Status
    res = client.get("/api/player/status", headers=auth_headers)
    assert res.status_code == 200
    assert "state" in res.json()

    # Play / Pause / Next / Previous commands
    res = client.post("/api/player/play", headers=auth_headers)
    assert res.status_code == 200

    res = client.post("/api/player/pause", headers=auth_headers)
    assert res.status_code == 200

    res = client.post("/api/player/previous", headers=auth_headers)
    assert res.status_code == 200

    res = client.post("/api/player/next", headers=auth_headers)
    assert res.status_code == 200

    # Volume
    res = client.post("/api/player/volume", json={"volume": 80}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["volume"] == 80

    # Seek
    res = client.post("/api/player/seek", json={"position": 10}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["position"] == 10

    # Shuffle
    res = client.post("/api/player/shuffle", json={"mode": 1}, headers=auth_headers)
    assert res.status_code == 200

    # Repeat
    res = client.post("/api/player/repeat", json={"mode": 0}, headers=auth_headers)
    assert res.status_code == 200

def test_playlist_endpoints(auth_headers):
    # Get Playlists
    res = client.get("/api/playlist/", headers=auth_headers)
    assert res.status_code == 200
    playlists = res.json()
    assert isinstance(playlists, list)

    # Insert URLs with default playlist ID
    res = client.post("/api/playlist/insert", json={"urls": ["file:///tmp/dummy.mp3"]}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["inserted_count"] == 1

    # Remove Songs
    res = client.post("/api/playlist/remove", json={"song_indices": [9999]}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["removed_count"] == 1

    # Clear Playlist endpoint
    res = client.post("/api/playlist/clear", json={"playlist_id": 9999}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert "cleared" in res.json()["message"]

def test_artwork_fallback():
    res = client.get("/api/artwork/current")
    assert res.status_code == 200
    assert "image/" in res.headers["content-type"]
