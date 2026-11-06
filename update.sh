#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Updating Clementine Web Remote..."

# Update Python dependencies
backend/venv/bin/pip install --upgrade -r backend/requirements.txt

# Recompile Protobuf if proto changed
backend/venv/bin/python3 -m grpc_tools.protoc \
    -Iproto --python_out=backend/app/adapters/clementine \
    proto/remotecontrolmessages.proto

# Rebuild frontend
cd frontend
npm install
npm run build
cd "$SCRIPT_DIR"

echo "Update complete!"
