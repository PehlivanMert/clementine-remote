import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .logging_config import setup_logging, logger
from .adapters.clementine.client import clementine_client
from .services.library_service import library_service
from .websocket.manager import manager

from .api import auth, player, playlist, library, artwork, system

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting Clementine Web Remote Backend...")

    # Start Clementine Client TCP connection loop
    await clementine_client.start()

    # Pre-index Library in background
    asyncio.create_task(asyncio.to_thread(library_service.initialize))

    # Start WebSocket heartbeat
    heartbeat_task = asyncio.create_task(manager.start_heartbeat())

    yield

    logger.info("Shutting down Clementine Web Remote...")
    heartbeat_task.cancel()
    await clementine_client.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(player.router)
app.include_router(playlist.router)
app.include_router(library.router)
app.include_router(artwork.router)
app.include_router(system.router)

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive client ping or messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"event":"pong"}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.debug(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Frontend Static Files (SPA Serving)
dist_dir = settings.FRONTEND_DIST_DIR
if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(dist_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))
else:
    @app.get("/")
    async def index():
        return {
            "name": settings.PROJECT_NAME,
            "status": "online",
            "frontend_built": False,
            "api_docs": "/docs",
            "system_info": "/api/system/info"
        }
