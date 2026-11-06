from typing import List, Optional
from pydantic import BaseModel
from .player import TrackMetadata

class PlaylistInfo(BaseModel):
    id: int
    name: str
    item_count: int = 0
    active: bool = False
    closed: bool = False
    favorite: bool = False

class PlaylistSongs(BaseModel):
    playlist: PlaylistInfo
    songs: List[TrackMetadata] = []

class ChangeSongRequest(BaseModel):
    playlist_id: int
    song_index: int

class InsertUrlsRequest(BaseModel):
    playlist_id: int = 1
    urls: List[str]
    position: int = -1
    play_now: bool = False
    enqueue: bool = False

class RemoveSongsRequest(BaseModel):
    playlist_id: int
    song_indices: List[int]

class UpdatePlaylistRequest(BaseModel):
    playlist_id: int
    new_playlist_name: Optional[str] = None
    clear_playlist: bool = False
