import os
import json
import socket
import subprocess
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

def detect_lan_ip() -> str:
    """Detect the active physical LAN IPv4 address (e.g. Wi-Fi 172.20.5.94).
    
    Explicitly filters out loopback, Docker bridges, and VPN tunnels (e.g. CloudflareWARP)
    to ensure the iPhone on the local Wi-Fi router connects to the reachable LAN interface.
    """
    try:
        out = subprocess.check_output(["ip", "-j", "addr", "show"], text=True, timeout=2.0)
        interfaces = json.loads(out)
        candidates = []
        for iface in interfaces:
            ifname = iface.get("ifname", "")
            flags = iface.get("flags", [])
            if "UP" not in flags or "LOOPBACK" in flags:
                continue
            # Ignore container, virtual bridge and VPN tunnel interfaces
            if ifname.startswith(("docker", "br-", "virbr", "veth", "tun", "tap", "wg", "Cloudflare", "tailscale")):
                continue
            for addr in iface.get("addr_info", []):
                if addr.get("family") == "inet":
                    ip = addr.get("local")
                    if ip and not ip.startswith("127."):
                        priority = 0
                        if ifname.startswith(("wl", "wlan", "wifi")):
                            priority = 2  # Wireless preferred for iPhone remote
                        elif ifname.startswith(("en", "eth")):
                            priority = 1  # Wired ethernet
                        candidates.append((priority, ip, ifname))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]
    except Exception:
        pass

    # Secondary fallback via routing table
    try:
        out = subprocess.check_output(["ip", "route", "show", "default"], text=True, timeout=2.0)
        for line in out.splitlines():
            parts = line.split()
            if "src" in parts:
                src_idx = parts.index("src")
                if src_idx + 1 < len(parts):
                    cand = parts[src_idx + 1]
                    if not cand.startswith("172.16.0."):  # Skip CloudflareWARP
                        return cand
    except Exception:
        pass

    return "172.20.5.94"

DETECTED_LAN_IP = detect_lan_ip()

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
    LAN_IP: str = DETECTED_LAN_IP

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

    # Production-safe CORS: Restrict to localhost and local network origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        f"http://{DETECTED_LAN_IP}:8000",
        f"http://{DETECTED_LAN_IP}:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
