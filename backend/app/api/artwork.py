import urllib.parse
from fastapi import APIRouter, Response, Query
from ..services.artwork_service import artwork_service

router = APIRouter(prefix="/api/artwork", tags=["artwork"])

DEFAULT_COVER_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#181a20"/>
      <stop offset="100%" stop-color="#0c0d10"/>
    </linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#bg)"/>
  <circle cx="150" cy="150" r="70" fill="none" stroke="#2a2e39" stroke-width="6"/>
  <circle cx="150" cy="150" r="30" fill="#ff7600" opacity="0.8"/>
  <circle cx="150" cy="150" r="8" fill="#0c0d10"/>
</svg>"""

@router.get("/current")
async def get_current_art(thumb: bool = Query(False)):
    data = artwork_service.get_current_artwork(thumbnail=thumb)
    if data:
        return Response(content=data, media_type="image/jpeg")
    return Response(content=DEFAULT_COVER_SVG, media_type="image/svg+xml")

@router.get("/file")
async def get_file_art(path: str = Query(...), thumb: bool = Query(False)):
    decoded_path = urllib.parse.unquote(path)
    if decoded_path.startswith("file://"):
        decoded_path = decoded_path[7:]

    data = artwork_service.get_file_artwork(decoded_path, thumbnail=thumb)
    if data:
        return Response(content=data, media_type="image/jpeg")
    return Response(content=DEFAULT_COVER_SVG, media_type="image/svg+xml")
