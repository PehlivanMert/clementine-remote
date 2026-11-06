from fastapi import APIRouter
from ..adapters.clementine.client import clementine_client
from ..services.library_service import library_service
from ..config import settings

router = APIRouter(prefix="/api/system", tags=["system"])

@router.get("/info")
async def system_info():
    return {
        "server_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "lan_ip": settings.LAN_IP,
        "server_port": settings.SERVER_PORT,
        "iphone_url": f"http://{settings.LAN_IP}:{settings.SERVER_PORT}",
        "clementine_connected": clementine_client.status.clementine_connected,
        "clementine_version": clementine_client.status.clementine_version,
        "clementine_port": settings.CLEMENTINE_PORT,
        "music_dir": settings.MUSIC_DIR,
        "library_tracks_count": len(library_service._tracks)
    }
