from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from ..adapters.clementine.client import clementine_client
from ..models.playlist import (
    PlaylistInfo, ChangeSongRequest, InsertUrlsRequest, RemoveSongsRequest,
    ClearPlaylistRequest, UpdatePlaylistRequest, CreatePlaylistRequest,
    RenamePlaylistRequest, ActivatePlaylistRequest, ClosePlaylistRequest
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
async def get_playlist_songs(playlist_id: int, refresh: bool = False, auth: bool = Depends(require_auth)):
    if playlist_id in clementine_client.playlists and clementine_client.playlists[playlist_id].item_count == 0:
        clementine_client.playlist_songs[playlist_id] = []
        return []

    needs_fetch = refresh or (playlist_id not in clementine_client.playlist_songs)
    if not needs_fetch and playlist_id in clementine_client.playlists:
        expected_count = clementine_client.playlists[playlist_id].item_count
        cached_count = len(clementine_client.playlist_songs.get(playlist_id, []))
        if expected_count != cached_count:
            needs_fetch = True

    if needs_fetch:
        songs = await clementine_client.request_playlist_songs(playlist_id, wait_response=True, timeout=2.5)
        return songs
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
        enqueue=req.enqueue,
        new_playlist_name=req.new_playlist_name
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

@router.post("/create")
async def create_playlist(req: CreatePlaylistRequest, auth: bool = Depends(require_auth)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Playlist name cannot be empty")
    await clementine_client.create_playlist(req.name.strip())
    return {"status": "ok", "name": req.name.strip()}

@router.post("/rename")
async def rename_playlist(req: RenamePlaylistRequest, auth: bool = Depends(require_auth)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Playlist name cannot be empty")
    await clementine_client.rename_playlist(req.playlist_id, req.name.strip())
    return {"status": "ok", "playlist_id": req.playlist_id, "name": req.name.strip()}

@router.post("/{playlist_id}/activate")
async def activate_playlist(playlist_id: int, auth: bool = Depends(require_auth)):
    await clementine_client.activate_playlist(playlist_id)
    return {"status": "ok", "active_playlist_id": playlist_id}

@router.post("/{playlist_id}/close")
async def close_playlist(playlist_id: int, auth: bool = Depends(require_auth)):
    await clementine_client.close_playlist(playlist_id)
    return {"status": "ok", "closed_playlist_id": playlist_id}

@router.post("/update")
async def update_playlist(req: UpdatePlaylistRequest, auth: bool = Depends(require_auth)):
    target_id = req.playlist_id if req.playlist_id and req.playlist_id > 0 else clementine_client.active_playlist_id
    await clementine_client.update_playlist(
        playlist_id=target_id,
        new_name=req.new_playlist_name,
        clear_playlist=req.clear_playlist,
        create_new_playlist=req.create_new_playlist
    )
    return {"status": "ok", "playlist_id": target_id}
