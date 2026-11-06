#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Stopping Clementine Web Remote..."
"$SCRIPT_DIR/scripts/clementine_watcher.py" --stop >/dev/null 2>&1 || true
pkill -f "uvicorn backend.app.main:app" || true
echo "Stopped."
