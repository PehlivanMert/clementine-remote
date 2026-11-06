from typing import List, Optional
from pydantic import BaseModel
from .player import TrackMetadata

class ArtistItem(BaseModel):
    name: str
    track_count: int = 0
    album_count: int = 0

class AlbumItem(BaseModel):
    name: str
    artist: str
    year: Optional[str] = ""
    track_count: int = 0
    art_available: bool = False
    sample_track_url: Optional[str] = ""

class SearchResults(BaseModel):
    query: str
    artists: List[ArtistItem] = []
    albums: List[AlbumItem] = []
    tracks: List[TrackMetadata] = []
