import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.adapters.clementine.protocol import pack_message, AsyncMessageParser
from backend.app.adapters.clementine import remotecontrolmessages_pb2 as pb
from backend.app.config import settings

client = TestClient(app)

def test_protocol_packing():
    msg = pb.Message(version=23, type=pb.CONNECT)
    msg.request_connect.auth_code = 1234
    data = pack_message(msg)
    assert len(data) > 4

    parser = AsyncMessageParser()
    messages = list(parser.feed(data))
    assert len(messages) == 1
    assert messages[0].type == pb.CONNECT
    assert messages[0].request_connect.auth_code == 1234

def test_system_info():
    res = client.get("/api/system/info")
    assert res.status_code == 200
    data = res.json()
    assert "lan_ip" in data
    assert "clementine_connected" in data
    assert data["server_port"] == settings.SERVER_PORT

def test_auth_flow():
    # 1. Status without auth
    res = client.get("/api/auth/status")
    assert res.status_code == 200
    assert res.json()["authenticated"] is False

    # 2. Login with wrong password
    res = client.post("/api/auth/login", json={"password": "wrongpassword"})
    assert res.status_code == 401

    # 3. Login with correct password
    res = client.post("/api/auth/login", json={"password": settings.WEB_PASSWORD})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "authenticated"
    assert "token" in data
    token = data["token"]

    # 4. Access protected endpoint with token header
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/player/status", headers=headers)
    assert res.status_code == 200
    status_data = res.json()
    assert "state" in status_data
    assert "volume" in status_data

    # 5. Access library with token
    res = client.get("/api/library/artists", headers=headers)
    assert res.status_code == 200
    artists = res.json()
    assert isinstance(artists, list)

    res = client.get("/api/library/search?q=pink", headers=headers)
    assert res.status_code == 200
    search_data = res.json()
    assert "tracks" in search_data
