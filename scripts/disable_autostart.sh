#!/usr/bin/env bash
set -e

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_NAME="clementine-watcher.service"

echo "=========================================================="
echo "Disabling Clementine Web Remote Autostart Watcher..."
echo "=========================================================="

# 1. Stop and disable systemd service
if systemctl --user is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "[*] Stopping $SERVICE_NAME..."
    systemctl --user stop "$SERVICE_NAME"
fi

if systemctl --user is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "[*] Disabling $SERVICE_NAME..."
    systemctl --user disable "$SERVICE_NAME"
fi

# 2. Trigger stop on manager to clean up browser and server if still running
"$PROJECT_DIR/scripts/clementine_watcher.py" --stop >/dev/null 2>&1 || true

echo "[+] Autostart watcher disabled."
echo "=========================================================="
