import os
import re
from fastapi import APIRouter
from ..adapters.clementine.client import clementine_client
from ..services.library_service import library_service
from ..config import settings

router = APIRouter(prefix="/api/system", tags=["system"])

def get_active_tunnel_url() -> str | None:
    log_file = "/tmp/clementine_cloudflared.log"
    pid_file = "/tmp/clementine_cloudflared.pid"
    if os.path.exists(log_file) and os.path.exists(pid_file):
        try:
            with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                matches = re.findall(r"https://[^\s]+\.trycloudflare\.com", content)
                if matches and "Registered tunnel connection" in content:
                    return matches[-1]
        except Exception:
            pass
    return None

@router.get("/info")
async def system_info():
    tunnel = get_active_tunnel_url()
    return {
        "server_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "lan_ip": settings.LAN_IP,
        "server_port": settings.SERVER_PORT,
        "iphone_url": f"http://{settings.LAN_IP}:{settings.SERVER_PORT}",
        "tunnel_url": tunnel,
        "ntfy_topic": "clementine_remote_mert_tunnel_450d9",
        "gist_id": "450d94b168498b7b178cd9f1ce667344",
        "clementine_connected": clementine_client.status.clementine_connected,
        "clementine_version": clementine_client.status.clementine_version,
        "clementine_port": settings.CLEMENTINE_PORT,
        "music_dir": settings.MUSIC_DIR,
        "library_tracks_count": len(library_service._tracks)
    }
