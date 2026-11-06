from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from ..adapters.clementine.client import clementine_client
from ..models.playlist import (
    PlaylistInfo, ChangeSongRequest, InsertUrlsRequest, RemoveSongsRequest,
    ClearPlaylistRequest, UpdatePlaylistRequest
)
from ..models.player import TrackMetadata
from ..security import require_auth

router = APIRouter(prefix="/api/playlist", tags=["playlist"])

@router.get("/", response_model=List[PlaylistInfo])
async def get_playlists(auth: bool = Depends(require_auth)):
    if not clementine_client.playlists:
        await clementine_client.request_playlists()
    return list(clementine_client.playlists.values())

@router.get("/{playlist_id}/songs", response_model=List[TrackMetadata])
async def get_playlist_songs(playlist_id: int, auth: bool = Depends(require_auth)):
    if playlist_id not in clementine_client.playlist_songs or not clementine_client.playlist_songs[playlist_id]:
        await clementine_client.request_playlist_songs(playlist_id)
    return clementine_client.playlist_songs.get(playlist_id, [])

@router.post("/change_song")
async def change_song(req: ChangeSongRequest, auth: bool = Depends(require_auth)):
    target_id = req.playlist_id if req.playlist_id and req.playlist_id > 0 else clementine_client.active_playlist_id
    await clementine_client.change_song(target_id, req.song_index)
    return {"status": "ok", "playlist_id": target_id, "song_index": req.song_index}

@router.post("/insert")
async def insert_urls(req: InsertUrlsRequest, auth: bool = Depends(require_auth)):
    target_id = req.playlist_id if req.playlist_id and req.playlist_id > 0 else clementine_client.active_playlist_id
    await clementine_client.insert_urls(
        playlist_id=target_id,
        urls=req.urls,
        position=req.position,
        play_now=req.play_now,
        enqueue=req.enqueue
    )
    return {"status": "ok", "playlist_id": target_id, "inserted_count": len(req.urls)}

@router.post("/remove")
async def remove_songs(req: RemoveSongsRequest, auth: bool = Depends(require_auth)):
    target_id = req.playlist_id if req.playlist_id and req.playlist_id > 0 else clementine_client.active_playlist_id
    await clementine_client.remove_songs(target_id, req.song_indices)
    return {"status": "ok", "playlist_id": target_id, "removed_count": len(req.song_indices)}

@router.post("/clear")
async def clear_playlist(req: ClearPlaylistRequest, auth: bool = Depends(require_auth)):
    target_id = req.playlist_id if req.playlist_id and req.playlist_id > 0 else clementine_client.active_playlist_id
    await clementine_client.clear_playlist(target_id)
    return {"status": "ok", "playlist_id": target_id, "message": "Playlist cleared"}

@router.post("/update")
async def update_playlist(req: UpdatePlaylistRequest, auth: bool = Depends(require_auth)):
    target_id = req.playlist_id if req.playlist_id and req.playlist_id > 0 else clementine_client.active_playlist_id
    await clementine_client.update_playlist(
        playlist_id=target_id,
        new_name=req.new_playlist_name,
        clear_playlist=req.clear_playlist
    )
    return {"status": "ok", "playlist_id": target_id}
