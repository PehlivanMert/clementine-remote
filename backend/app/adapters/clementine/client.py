import asyncio
import logging
from typing import Dict, List, Optional, Callable, Any
from . import remotecontrolmessages_pb2 as pb
from .protocol import pack_message, AsyncMessageParser
from ...models.player import PlayerStatus, TrackMetadata
from ...models.playlist import PlaylistInfo
from ...config import settings

logger = logging.getLogger("clementine_client")

class ClementineClient:
    def __init__(self):
        self.reader: Optional[asyncio.StreamReader] = None
        self.writer: Optional[asyncio.StreamWriter] = None
        self.parser = AsyncMessageParser()

        # Internal State
        self.status = PlayerStatus()
        self.playlists: Dict[int, PlaylistInfo] = {}
        self.playlist_songs: Dict[int, List[TrackMetadata]] = {}
        self.active_playlist_id: int = 1
        self.current_art: Optional[bytes] = None

        self._running = False
        self._connected = False
        self._reconnect_task: Optional[asyncio.Task] = None
        self._read_task: Optional[asyncio.Task] = None
        self._listeners: List[Callable[[str, Any], None]] = []

    def add_listener(self, callback: Callable[[str, Any], None]):
        """Register a callback for state changes: callback(event_name, data)"""
        self._listeners.append(callback)

    def _notify(self, event_name: str, data: Any = None):
        for listener in self._listeners:
            try:
                res = listener(event_name, data)
                if asyncio.iscoroutine(res):
                    asyncio.create_task(res)
            except Exception as e:
                logger.error(f"Error notifying listener for {event_name}: {e}")

    async def start(self):
        """Start the client connection and background runner."""
        self._running = True
        self._reconnect_task = asyncio.create_task(self._connection_loop())

    async def stop(self):
        """Stop the client and close connections."""
        self._running = False
        if self._reconnect_task:
            self._reconnect_task.cancel()
        if self._read_task:
            self._read_task.cancel()
        await self._disconnect()

    async def _disconnect(self):
        self._connected = False
        self.status.clementine_connected = False
        if self.writer:
            try:
                self.writer.close()
                await self.writer.wait_closed()
            except Exception:
                pass
            self.writer = None
            self.reader = None
        self._notify("clementine_connection_changed", False)

    async def _connection_loop(self):
        """Main loop that maintains a connection to Clementine."""
        backoff = 1.0
        while self._running:
            hosts = [settings.CLEMENTINE_HOST, settings.CLEMENTINE_FALLBACK_HOST]
            connected = False

            for host in hosts:
                try:
                    logger.info(f"Attempting connection to Clementine at [{host}]:{settings.CLEMENTINE_PORT}...")
                    self.reader, self.writer = await asyncio.wait_for(
                        asyncio.open_connection(host, settings.CLEMENTINE_PORT),
                        timeout=3.0
                    )
                    self._connected = True
                    self.status.clementine_connected = True
                    logger.info(f"Connected to Clementine on [{host}]:{settings.CLEMENTINE_PORT}")
                    connected = True
                    break
                except Exception as e:
                    logger.debug(f"Connection attempt to [{host}] failed: {e}")

            if connected:
                backoff = 1.0
                self._notify("clementine_connection_changed", True)
                try:
                    # Handshake: send CONNECT
                    await self._send_connect()
                    # Read messages until disconnected
                    await self._read_messages()
                except Exception as e:
                    logger.warning(f"Connection to Clementine closed: {e}")
                finally:
                    await self._disconnect()

            if self._running:
                logger.info(f"Reconnecting to Clementine in {backoff:.1f} seconds...")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 1.5, 10.0)

    async def _send_connect(self):
        msg = pb.Message(version=23, type=pb.CONNECT)
        msg.request_connect.auth_code = settings.CLEMENTINE_AUTH_CODE
        msg.request_connect.send_playlist_songs = True
        msg.request_connect.downloader = False
        await self._send_message(msg)

    async def _send_message(self, msg: pb.Message):
        if not self.writer or self.writer.is_closing():
            logger.warning("Cannot send message: not connected to Clementine")
            return
        try:
            data = pack_message(msg)
            self.writer.write(data)
            await self.writer.drain()
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            await self._disconnect()

    async def _read_messages(self):
        """Read and dispatch messages from Clementine."""
        while self._connected and self.reader:
            chunk = await self.reader.read(65536)
            if not chunk:
                logger.info("Clementine closed the TCP socket")
                break

            for msg in self.parser.feed(chunk):
                self._handle_message(msg)

    def _handle_message(self, msg: pb.Message):
        """Dispatch incoming protobuf message from Clementine."""
        msg_type = msg.type

        if msg_type == pb.INFO:
            info = msg.response_clementine_info
            self.status.clementine_version = info.version
            state_map = {0: "Empty", 1: "Idle", 2: "Playing", 3: "Paused"}
            self.status.state = state_map.get(info.state, "Idle")
            self._notify("state_changed", self.status.state)

        elif msg_type == pb.CURRENT_METAINFO:
            raw = msg.response_current_metadata.song_metadata
            track = TrackMetadata(
                id=raw.id if raw.HasField('id') else None,
                index=raw.index,
                title=raw.title,
                artist=raw.artist,
                album=raw.album,
                albumartist=raw.albumartist if raw.HasField('albumartist') else "",
                track=raw.track if raw.HasField('track') else 0,
                disc=raw.disc if raw.HasField('disc') else 0,
                length=raw.length,
                pretty_length=raw.pretty_length,
                year=raw.pretty_year if raw.HasField('pretty_year') else "",
                genre=raw.genre if raw.HasField('genre') else "",
                is_local=raw.is_local,
                filename=raw.filename if raw.HasField('filename') else "",
                url=raw.url if raw.HasField('url') else "",
                has_art=bool(raw.art)
            )
            self.status.current_track = track
            self.status.duration = raw.length

            if raw.HasField('art') and len(raw.art) > 0:
                self.current_art = raw.art
                track.has_art = True

            self._notify("track_changed", track)

        elif msg_type == pb.SET_VOLUME:
            vol = msg.request_set_volume.volume
            self.status.volume = vol
            self._notify("volume_changed", vol)

        elif msg_type == pb.PLAY:
            self.status.state = "Playing"
            self._notify("state_changed", "Playing")

        elif msg_type == pb.PAUSE:
            self.status.state = "Paused"
            self._notify("state_changed", "Paused")

        elif msg_type == pb.STOP:
            self.status.state = "Idle"
            self.status.position = 0
            self._notify("state_changed", "Idle")

        elif msg_type == pb.UPDATE_TRACK_POSITION:
            pos = msg.response_update_track_position.position
            self.status.position = pos
            self._notify("position_changed", pos)

        elif msg_type == pb.PLAYLISTS:
            pl_resp = msg.response_playlists
            for p in pl_resp.playlist:
                info = PlaylistInfo(
                    id=p.id,
                    name=p.name,
                    item_count=p.item_count,
                    active=p.active,
                    closed=p.closed,
                    favorite=p.favorite
                )
                self.playlists[p.id] = info
                if p.active:
                    self.active_playlist_id = p.id
            self._notify("playlists_updated", list(self.playlists.values()))

        elif msg_type == pb.ACTIVE_PLAYLIST_CHANGED:
            new_id = msg.response_active_changed.id
            self.active_playlist_id = new_id
            for pid in self.playlists:
                self.playlists[pid].active = (pid == new_id)
            self._notify("active_playlist_changed", new_id)

        elif msg_type == pb.PLAYLIST_SONGS:
            pl_songs = msg.response_playlist_songs
            req_pl = pl_songs.requested_playlist
            pl_id = req_pl.id

            songs = []
            for s in pl_songs.songs:
                meta = TrackMetadata(
                    id=s.id if s.HasField('id') else None,
                    index=s.index,
                    title=s.title,
                    artist=s.artist,
                    album=s.album,
                    albumartist=s.albumartist if s.HasField('albumartist') else "",
                    track=s.track if s.HasField('track') else 0,
                    disc=s.disc if s.HasField('disc') else 0,
                    length=s.length,
                    pretty_length=s.pretty_length,
                    year=s.pretty_year if s.HasField('pretty_year') else "",
                    genre=s.genre if s.HasField('genre') else "",
                    is_local=s.is_local,
                    filename=s.filename if s.HasField('filename') else "",
                    url=s.url if s.HasField('url') else "",
                    has_art=False
                )
                songs.append(meta)

            self.playlist_songs[pl_id] = songs
            if pl_id in self.playlists:
                self.playlists[pl_id].item_count = len(songs)

            self._notify("playlist_songs_updated", {"playlist_id": pl_id, "songs": songs})

        elif msg_type == pb.REPEAT:
            mode = msg.repeat.repeat_mode
            self.status.repeat_mode = mode
            self._notify("repeat_changed", mode)

        elif msg_type == pb.SHUFFLE:
            mode = msg.shuffle.shuffle_mode
            self.status.shuffle_mode = mode
            self._notify("shuffle_changed", mode)

        elif msg_type == pb.FIRST_DATA_SENT_COMPLETE:
            logger.info("Clementine initial sync complete")
            self._notify("sync_complete", self.status)

    # Command Execution
    async def play(self):
        await self._send_message(pb.Message(version=23, type=pb.PLAY))

    async def pause(self):
        await self._send_message(pb.Message(version=23, type=pb.PAUSE))

    async def play_pause(self):
        await self._send_message(pb.Message(version=23, type=pb.PLAYPAUSE))

    async def stop(self):
        await self._send_message(pb.Message(version=23, type=pb.STOP))

    async def next(self):
        await self._send_message(pb.Message(version=23, type=pb.NEXT))

    async def previous(self):
        await self._send_message(pb.Message(version=23, type=pb.PREVIOUS))

    async def set_volume(self, volume: int):
        vol = max(0, min(100, volume))
        msg = pb.Message(version=23, type=pb.SET_VOLUME)
        msg.request_set_volume.volume = vol
        await self._send_message(msg)

    async def set_track_position(self, position_seconds: int):
        pos = max(0, position_seconds)
        msg = pb.Message(version=23, type=pb.SET_TRACK_POSITION)
        msg.request_set_track_position.position = pos
        await self._send_message(msg)

    async def change_song(self, playlist_id: int, song_index: int):
        msg = pb.Message(version=23, type=pb.CHANGE_SONG)
        msg.request_change_song.playlist_id = playlist_id
        msg.request_change_song.song_index = song_index
        await self._send_message(msg)

    async def insert_urls(self, playlist_id: int, urls: List[str], position: int = -1, play_now: bool = False, enqueue: bool = False):
        msg = pb.Message(version=23, type=pb.INSERT_URLS)
        req = msg.request_insert_urls
        req.playlist_id = playlist_id
        req.urls.extend(urls)
        req.position = position
        req.play_now = play_now
        req.enqueue = enqueue
        await self._send_message(msg)

    async def remove_songs(self, playlist_id: int, song_indices: List[int]):
        msg = pb.Message(version=23, type=pb.REMOVE_SONGS)
        msg.request_remove_songs.playlist_id = playlist_id
        msg.request_remove_songs.songs.extend(song_indices)
        await self._send_message(msg)

    async def set_shuffle(self, mode: int):
        msg = pb.Message(version=23, type=pb.SHUFFLE)
        msg.shuffle.shuffle_mode = mode
        await self._send_message(msg)

    async def set_repeat(self, mode: int):
        msg = pb.Message(version=23, type=pb.REPEAT)
        msg.repeat.repeat_mode = mode
        await self._send_message(msg)

    async def request_playlists(self):
        msg = pb.Message(version=23, type=pb.REQUEST_PLAYLISTS)
        msg.request_playlists.include_closed = False
        await self._send_message(msg)

    async def request_playlist_songs(self, playlist_id: int):
        msg = pb.Message(version=23, type=pb.REQUEST_PLAYLIST_SONGS)
        msg.request_playlist_songs.id = playlist_id
        await self._send_message(msg)

# Global client singleton
clementine_client = ClementineClient()
