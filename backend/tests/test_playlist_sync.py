import asyncio
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.app.websocket.manager import serialize_for_ws, manager
from backend.app.adapters.clementine.client import ClementineClient
from backend.app.models.player import TrackMetadata
from backend.app.models.playlist import PlaylistInfo
from backend.app.adapters.clementine import remotecontrolmessages_pb2 as pb
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings

def test_serialize_for_ws_with_nested_track_metadata():
    """Verify that serialize_for_ws recursively serializes TrackMetadata inside dicts and lists, preventing TypeError."""
    track = TrackMetadata(
        index=0,
        title="Comfortably Numb",
        artist="Pink Floyd",
        album="The Wall",
        length=382,
        is_local=True
    )

    data = {
        "playlist_id": 1,
        "songs": [track]
    }

    serialized = serialize_for_ws(data)
    assert isinstance(serialized["songs"][0], dict)
    assert serialized["songs"][0]["title"] == "Comfortably Numb"
    assert serialized["playlist_id"] == 1

    # Crucial test: json.dumps MUST succeed without raising TypeError
    json_str = json.dumps({"event": "playlist_songs_updated", "data": serialized})
    assert "Comfortably Numb" in json_str

def test_remove_songs_optimistic_update():
    """Verify that removing a song optimistically updates playlist_songs and item_count, and reindexes."""
    async def _test():
        client = ClementineClient()
        client._send_message = AsyncMock()

        # Setup playlist 1 with 3 tracks
        client.playlists[1] = PlaylistInfo(id=1, name="My List", item_count=3, active=True)
        client.playlist_songs[1] = [
            TrackMetadata(index=0, title="Song 0", artist="Artist", album="Album", length=100),
            TrackMetadata(index=1, title="Song 1", artist="Artist", album="Album", length=100),
            TrackMetadata(index=2, title="Song 2", artist="Artist", album="Album", length=100),
        ]

        notified_events = []
        client.add_listener(lambda event, data: notified_events.append((event, data)))

        # Remove song at index 1
        await client.remove_songs(1, [1])

        # Assert remaining songs
        remaining = client.playlist_songs[1]
        assert len(remaining) == 2
        assert remaining[0].title == "Song 0"
        assert remaining[0].index == 0
        assert remaining[1].title == "Song 2"
        assert remaining[1].index == 1

        # Assert playlist item_count decremented
        assert client.playlists[1].item_count == 2

        # Assert events emitted
        event_names = [e[0] for e in notified_events]
        assert "playlist_songs_updated" in event_names
        assert "playlists_updated" in event_names

    asyncio.run(_test())

def test_clear_playlist_optimistic_update():
    """Verify that clearing a playlist empties cache and item_count immediately."""
    async def _test():
        client = ClementineClient()
        client._send_message = AsyncMock()

        client.playlists[1] = PlaylistInfo(id=1, name="Queue", item_count=2, active=True)
        client.playlist_songs[1] = [
            TrackMetadata(index=0, title="Song 0", artist="Artist", album="Album", length=100),
            TrackMetadata(index=1, title="Song 1", artist="Artist", album="Album", length=100),
        ]

        await client.clear_playlist(1)

        assert client.playlist_songs[1] == []
        assert client.playlists[1].item_count == 0

    asyncio.run(_test())

def test_playlists_message_triggers_song_fetch_on_count_mismatch():
    """Verify that when Clementine sends PLAYLISTS with a different count, request_playlist_songs is called."""
    async def _test():
        client = ClementineClient()
        client._send_message = AsyncMock()
        client.request_playlist_songs = AsyncMock()

        client.playlists[1] = PlaylistInfo(id=1, name="List", item_count=2, active=True)
        client.playlist_songs[1] = [
            TrackMetadata(index=0, title="Song 0", artist="Artist", album="Album", length=100),
            TrackMetadata(index=1, title="Song 1", artist="Artist", album="Album", length=100),
        ]

        # Create incoming PLAYLISTS message where item_count is now 3 (e.g. song added on PC)
        msg = pb.Message(version=23, type=pb.PLAYLISTS)
        pl = msg.response_playlists.playlist.add()
        pl.id = 1
        pl.name = "List"
        pl.item_count = 3
        pl.active = True
        pl.closed = False

        client._handle_message(msg)

        # Allow spawned tasks to run
        await asyncio.sleep(0.01)

        assert client.playlists[1].item_count == 3
        client.request_playlist_songs.assert_called_with(1)

    asyncio.run(_test())

def test_playlists_message_with_zero_count_clears_songs():
    """Verify that when Clementine sends PLAYLISTS with count=0, cached songs are cleared."""
    async def _test():
        client = ClementineClient()
        client._send_message = AsyncMock()

        client.playlists[1] = PlaylistInfo(id=1, name="List", item_count=2, active=True)
        client.playlist_songs[1] = [
            TrackMetadata(index=0, title="Song 0", artist="Artist", album="Album", length=100),
            TrackMetadata(index=1, title="Song 1", artist="Artist", album="Album", length=100),
        ]

        notified = []
        client.add_listener(lambda ev, data: notified.append((ev, data)))

        msg = pb.Message(version=23, type=pb.PLAYLISTS)
        pl = msg.response_playlists.playlist.add()
        pl.id = 1
        pl.name = "List"
        pl.item_count = 0
        pl.active = True

        client._handle_message(msg)

        assert client.playlist_songs[1] == []
        assert any(ev[0] == "playlist_songs_updated" and ev[1]["songs"] == [] for ev in notified)

    asyncio.run(_test())

def test_playlist_songs_waiter_resolution():
    """Verify that request_playlist_songs with wait_response=True pauses until PLAYLIST_SONGS arrives."""
    async def _test():
        client = ClementineClient()
        client._send_message = AsyncMock()

        async def simulate_incoming_songs():
            await asyncio.sleep(0.05)
            msg = pb.Message(version=23, type=pb.PLAYLIST_SONGS)
            msg.response_playlist_songs.requested_playlist.id = 1
            s = msg.response_playlist_songs.songs.add()
            s.index = 0
            s.title = "High Hopes"
            s.artist = "Pink Floyd"
            s.album = "The Division Bell"
            s.length = 512
            client._handle_message(msg)

        asyncio.create_task(simulate_incoming_songs())

        songs = await client.request_playlist_songs(1, wait_response=True, timeout=1.0)
        assert len(songs) == 1
        assert songs[0].title == "High Hopes"

    asyncio.run(_test())

def test_request_playlist_songs_wait_response_false_does_not_leak_waiters():
    """Verify that request_playlist_songs with wait_response=False does not leak pending Event waiters."""
    async def _test():
        client = ClementineClient()
        client._send_message = AsyncMock()

        await client.request_playlist_songs(1, wait_response=False)
        assert 1 not in client._pending_song_waiters or len(client._pending_song_waiters[1]) == 0

    asyncio.run(_test())

@pytest.fixture
def auth_headers():
    client = TestClient(app)
    res = client.post("/api/auth/login", json={"password": settings.WEB_PASSWORD})
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_get_playlist_songs_fast_path_empty(auth_headers):
    """Verify that get_playlist_songs API returns [] immediately if item_count is 0."""
    from backend.app.adapters.clementine.client import clementine_client
    clementine_client.playlists[99] = PlaylistInfo(id=99, name="Empty List", item_count=0, active=False)
    client = TestClient(app)

    response = client.get("/api/playlist/99/songs", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []

def test_broadcast_failsafe_with_custom_object():
    """Verify that manager.broadcast does not crash on unhandled objects thanks to the fallback default serializer."""
    class CustomObj:
        def __str__(self):
            return "custom_str_repr"

    async def _test():
        mock_ws = AsyncMock()
        manager.active_connections.add(mock_ws)
        try:
            msg = {"event": "test_event", "data": {"custom": CustomObj()}}
            await manager.broadcast(msg)
            assert mock_ws.send_text.called
            sent_text = mock_ws.send_text.call_args[0][0]
            assert "custom_str_repr" in sent_text
        finally:
            manager.active_connections.discard(mock_ws)

    asyncio.run(_test())
