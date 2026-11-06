import asyncio
import json
import logging
from typing import Set, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from ..adapters.clementine.client import clementine_client

logger = logging.getLogger("websocket_manager")

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._setup_clementine_listener()
        self._heartbeat_task: Optional[asyncio.Task] = None

    def _setup_clementine_listener(self):
        """Hook into clementine_client events and broadcast them."""
        clementine_client.add_listener(self._on_clementine_event)

    def _on_clementine_event(self, event_type: str, data: Any):
        payload = {"event": event_type}
        if hasattr(data, "model_dump"):
            payload["data"] = data.model_dump()
        elif hasattr(data, "dict"):
            payload["data"] = data.dict()
        elif isinstance(data, list):
            payload["data"] = [x.model_dump() if hasattr(x, "model_dump") else x for x in data]
        else:
            payload["data"] = data

        asyncio.create_task(self.broadcast(payload))

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

        # Send initial full state snapshot
        snapshot = {
            "event": "initial_state",
            "data": {
                "status": clementine_client.status.model_dump(),
                "active_playlist_id": clementine_client.active_playlist_id,
                "playlists": [p.model_dump() for p in clementine_client.playlists.values()],
                "active_songs": [
                    s.model_dump()
                    for s in clementine_client.playlist_songs.get(clementine_client.active_playlist_id, [])
                ]
            }
        }
        await websocket.send_text(json.dumps(snapshot))

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        if not self.active_connections:
            return

        text = json.dumps(message)
        disconnected = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_text(text)
            except Exception:
                disconnected.add(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def start_heartbeat(self):
        """Keep mobile safari connections alive with ping every 15s."""
        while True:
            await asyncio.sleep(15)
            await self.broadcast({"event": "ping", "timestamp": asyncio.get_event_loop().time()})

manager = ConnectionManager()
