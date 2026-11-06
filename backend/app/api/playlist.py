from typing import List
from fastapi import APIRouter, Depends, HTTPException
from ..adapters.clementine.client import clementine_client
from ..models.playlist import (
    PlaylistInfo, ChangeSongRequest, InsertUrlsRequest, RemoveSongsRequest, UpdatePlaylistRequest
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
    await clementine_client.change_song(req.playlist_id, req.song_index)
    return {"status": "ok"}

@router.post("/insert")
async def insert_urls(req: InsertUrlsRequest, auth: bool = Depends(require_auth)):
    await clementine_client.insert_urls(
        playlist_id=req.playlist_id,
        urls=req.urls,
        position=req.position,
        play_now=req.play_now,
        enqueue=req.enqueue
    )
    return {"status": "ok", "inserted_count": len(req.urls)}

@router.post("/remove")
async def remove_songs(req: RemoveSongsRequest, auth: bool = Depends(require_auth)):
    await clementine_client.remove_songs(req.playlist_id, req.song_indices)
    return {"status": "ok", "removed_count": len(req.song_indices)}
