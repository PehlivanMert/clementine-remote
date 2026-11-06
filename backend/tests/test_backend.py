import pytest
from starlette.websockets import WebSocketDisconnect
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.adapters.clementine.protocol import pack_message, AsyncMessageParser
from backend.app.adapters.clementine import remotecontrolmessages_pb2 as pb
from backend.app.config import settings, detect_lan_ip
from backend.app.security import login_rate_limiter, create_access_token

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
    assert not data["lan_ip"].startswith("172.16.0.")  # Must not be CloudflareWARP VPN!

def test_lan_ip_detection():
    ip = detect_lan_ip()
    assert ip is not None
    assert not ip.startswith("127.")
    assert not ip.startswith("172.16.0.")  # Not VPN
    assert not ip.startswith("172.17.")    # Not Docker
    assert not ip.startswith("172.18.")    # Not Docker bridge

def test_auth_flow():
    # Reset limiter for test
    login_rate_limiter.reset("testclient")

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

def test_login_rate_limiting():
    fake_ip = "192.168.1.100"
    login_rate_limiter.reset(fake_ip)

    # Record 5 failed attempts
    for _ in range(5):
        login_rate_limiter.record_failed_attempt(fake_ip)

    assert login_rate_limiter.is_rate_limited(fake_ip) is True
    login_rate_limiter.reset(fake_ip)
    assert login_rate_limiter.is_rate_limited(fake_ip) is False

def test_websocket_unauthenticated_rejection():
    # Fresh unauthenticated client without session cookies
    unauth_client = TestClient(app)
    unauth_client.cookies.clear()
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with unauth_client.websocket_connect("/ws") as ws:
            ws.receive_text()
    assert exc_info.value.code == 1008

def test_websocket_authenticated_acceptance():
    token = create_access_token({"sub": "test_user"})
    with client.websocket_connect(f"/ws?token={token}") as ws:
        data = ws.receive_json()
        assert data["event"] == "initial_state"
        assert "status" in data["data"]

def test_spa_serving():
    res = client.get("/")
    assert res.status_code == 200
    assert "<!doctype html>" in res.text
    assert "Clementine Web Remote" in res.text

def test_manifest_serving():
    res = client.get("/manifest.webmanifest")
    assert res.status_code == 200
    assert "Clementine Web Remote" in res.text
