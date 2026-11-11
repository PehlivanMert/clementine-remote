from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from ..services.library_service import library_service
from ..models.library import ArtistItem, AlbumItem, SearchResults
from ..models.player import TrackMetadata
from ..security import require_auth

router = APIRouter(prefix="/api/library", tags=["library"])

@router.get("/artists", response_model=List[ArtistItem])
async def get_artists(
    format: Optional[str] = Query(None),
    auth: bool = Depends(require_auth)
):
    return library_service.get_artists(format=format)

@router.get("/albums", response_model=List[AlbumItem])
async def get_albums(
    artist: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    auth: bool = Depends(require_auth)
):
    return library_service.get_albums(artist=artist, format=format)

@router.get("/tracks", response_model=List[TrackMetadata])
async def get_tracks(
    artist: Optional[str] = Query(None),
    album: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    auth: bool = Depends(require_auth)
):
    return library_service.get_tracks(artist=artist, album=album, format=format)

@router.get("/search", response_model=SearchResults)
async def search(
    q: str = Query(""),
    format: Optional[str] = Query(None),
    auth: bool = Depends(require_auth)
):
    return library_service.search(q, format=format)
