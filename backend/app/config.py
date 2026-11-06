import os
import socket
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings

def get_lan_ip() -> str:
    """Detect the active LAN IPv4 address (e.g. Wi-Fi 172.20.5.94)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Does not actually send data
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '172.20.5.94'

class Settings(BaseSettings):
    PROJECT_NAME: str = "Clementine Web Remote"
    VERSION: str = "1.0.0"

    # Clementine TCP connection
    CLEMENTINE_HOST: str = "172.20.5.94"
    CLEMENTINE_FALLBACK_HOST: str = "::1"
    CLEMENTINE_PORT: int = 5500
    CLEMENTINE_AUTH_CODE: int = 77954

    # Web Remote Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    LAN_IP: str = get_lan_ip()

    # Web Security & Authentication
    WEB_PASSWORD: str = "clementine"
    JWT_SECRET: str = "c13m3nt1n3-w3b-r3m0t3-s3cr3t-k3y-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days

    # Storage & Paths
    CLEMENTINE_DB_PATH: str = "/home/mert/.config/Clementine/clementine.db"
    MUSIC_DIR: str = "/home/mert/Müzik"
    ARTWORK_CACHE_DIR: str = "/tmp/clementine_art_cache"
    FRONTEND_DIST_DIR: str = "/home/mert/clementine-web-remote/frontend/dist"

    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
