#!/usr/bin/env bash
set -e

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_NAME="clementine-watcher.service"
SERVICE_SRC="$PROJECT_DIR/systemd/$SERVICE_NAME"
SERVICE_DST="$SYSTEMD_USER_DIR/$SERVICE_NAME"

echo "=========================================================="
echo "Enabling Clementine Web Remote Autostart Watcher..."
echo "=========================================================="

# 1. Ensure user systemd directory exists
mkdir -p "$SYSTEMD_USER_DIR"

# 2. Copy/update service file
cp "$SERVICE_SRC" "$SERVICE_DST"
echo "[+] Installed: $SERVICE_DST"

# 3. Reload systemd user daemon
systemctl --user daemon-reload

# 4. Enable and start service immediately
systemctl --user enable --now "$SERVICE_NAME"
echo "[+] Service enabled and started: $SERVICE_NAME"

# 5. Show status summary
echo "----------------------------------------------------------"
systemctl --user status "$SERVICE_NAME" --no-pager || true
echo "----------------------------------------------------------"
echo "Autostart watcher is active!"
echo "Whenever Clementine is opened, Web Remote will start automatically."
echo "=========================================================="
