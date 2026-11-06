#!/usr/bin/env bash

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_NAME="clementine-watcher.service"

echo "=========================================================="
echo "Clementine Web Remote Autostart Watcher Status"
echo "=========================================================="

echo "[1] Systemd User Service:"
systemctl --user status "$SERVICE_NAME" --no-pager 2>&1 || true

echo ""
echo "[2] Process & Component State:"
"$PROJECT_DIR/scripts/clementine_watcher.py" --status 2>/dev/null || true

echo "=========================================================="
