from fastapi import APIRouter, Depends
from ..adapters.clementine.client import clementine_client
from ..models.player import (
    PlayerStatus, VolumeCommand, SeekCommand, ShuffleCommand, RepeatCommand
)
from ..security import require_auth

router = APIRouter(prefix="/api/player", tags=["player"])

@router.get("/status", response_model=PlayerStatus)
async def get_status(auth: bool = Depends(require_auth)):
    return clementine_client.status

@router.post("/play")
async def play(auth: bool = Depends(require_auth)):
    await clementine_client.play()
    return {"status": "ok"}

@router.post("/pause")
async def pause(auth: bool = Depends(require_auth)):
    await clementine_client.pause()
    return {"status": "ok"}

@router.post("/play_pause")
async def play_pause(auth: bool = Depends(require_auth)):
    await clementine_client.play_pause()
    return {"status": "ok"}

@router.post("/stop")
async def stop(auth: bool = Depends(require_auth)):
    await clementine_client.stop()
    return {"status": "ok"}

@router.post("/next")
async def next_track(auth: bool = Depends(require_auth)):
    await clementine_client.next()
    return {"status": "ok"}

@router.post("/previous")
async def previous_track(auth: bool = Depends(require_auth)):
    await clementine_client.previous()
    return {"status": "ok"}

@router.post("/volume")
async def set_volume(cmd: VolumeCommand, auth: bool = Depends(require_auth)):
    await clementine_client.set_volume(cmd.volume)
    return {"status": "ok", "volume": cmd.volume}

@router.post("/seek")
async def set_position(cmd: SeekCommand, auth: bool = Depends(require_auth)):
    await clementine_client.set_track_position(cmd.position)
    return {"status": "ok", "position": cmd.position}

@router.post("/shuffle")
async def set_shuffle(cmd: ShuffleCommand, auth: bool = Depends(require_auth)):
    await clementine_client.set_shuffle(cmd.mode)
    return {"status": "ok", "shuffle_mode": cmd.mode}

@router.post("/repeat")
async def set_repeat(cmd: RepeatCommand, auth: bool = Depends(require_auth)):
    await clementine_client.set_repeat(cmd.mode)
    return {"status": "ok", "repeat_mode": cmd.mode}
