#!/usr/bin/env bash
set -e

# ==============================================================================
# Clementine Web Remote — Production Installer
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "Installing Clementine Web Remote..."
echo "=========================================================="

# 1. Environment Verification
echo "[1/6] Checking system environment..."
if ! command -v clementine &>/dev/null; then
    echo "ERROR: Clementine is not installed or not in PATH."
    exit 1
fi
CLEMENTINE_VER=$(clementine --version 2>&1 || true)
echo "Found: $CLEMENTINE_VER"

if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 is required."
    exit 1
fi
echo "Found Python: $(python3 --version)"

if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is required."
    exit 1
fi
echo "Found Node.js: $(node --version)"

# 2. Python Virtual Environment
echo "[2/6] Setting up Python virtual environment..."
if [ ! -d "backend/venv" ]; then
    python3 -m venv backend/venv
fi
backend/venv/bin/pip install --upgrade pip
backend/venv/bin/pip install -r backend/requirements.txt

# 3. Compile Protocol Buffers
echo "[3/6] Compiling Protobuf messages..."
backend/venv/bin/python3 -m grpc_tools.protoc \
    -Iproto --python_out=backend/app/adapters/clementine \
    proto/remotecontrolmessages.proto

# 4. Frontend Build
echo "[4/6] Building React frontend..."
cd frontend
npm install
npm run build
cd "$SCRIPT_DIR"

# 5. Configuration Setup
echo "[5/6] Checking configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Created .env from .env.example"
    fi
fi

# Detect LAN IP
LAN_IP=$(ip -4 addr show wlo1 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || true)
if [ -z "$LAN_IP" ]; then
    LAN_IP=$(hostname -I | awk '{print $1}')
fi

echo "=========================================================="
echo "Installation complete!"
echo "To start the application run: ./start.sh"
echo "Access from iPhone Safari:   http://${LAN_IP}:8000"
echo "=========================================================="
