#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Check if Clementine is running
if ! pgrep -x "clementine" >/dev/null; then
    echo "[!] Clementine is not running. Starting Clementine in background..."
    clementine >/dev/null 2>&1 &
    sleep 2
fi

# 2. Check Clementine port 5500
if ! ss -tlpn 2>/dev/null | grep -q ":5500"; then
    echo "[!] Warning: Clementine remote port 5500 is not listening."
    echo "    Please verify that Network Remote Control is enabled in Clementine Preferences."
fi

# 3. Detect LAN IP (consistent with backend config)
LAN_IP=$(backend/venv/bin/python3 -c "from backend.app.config import settings; print(settings.LAN_IP)" 2>/dev/null || ip -4 addr show wlo1 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "172.20.5.94")

PORT=8000
echo "=========================================================="
echo "Starting Clementine Web Remote..."
echo "Local Dashboard:    http://127.0.0.1:${PORT}"
echo "iPhone Safari URL:  http://${LAN_IP}:${PORT}"
echo "=========================================================="

export PYTHONPATH="$SCRIPT_DIR"
exec backend/venv/bin/python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port "$PORT"
