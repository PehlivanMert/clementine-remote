#!/usr/bin/env bash

echo "Stopping Clementine Web Remote..."
pkill -f "uvicorn backend.app.main:app" || true
echo "Stopped."
