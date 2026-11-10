from typing import Optional
from fastapi import APIRouter, Depends, Query
from ..adapters.clementine.client import clementine_client
from ..services.lyrics_service import lyrics_service
from ..models.player import (
    PlayerStatus, VolumeCommand, SeekCommand, ShuffleCommand, RepeatCommand,
    SleepTimerRequest
)
from ..services.sleep_timer_service import sleep_timer_service
from ..security import require_auth

router = APIRouter(prefix="/api/player", tags=["player"])

@router.get("/lyrics")
async def get_lyrics(
    artist: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    album: Optional[str] = Query(None),
    duration: Optional[int] = Query(None),
    auth: bool = Depends(require_auth)
):
    cur = clementine_client.status.current_track
    target_artist = artist or (cur.artist if cur else "")
    target_title = title or (cur.title if cur else "")
    target_album = album or (cur.album if cur else "")
    target_duration = duration or (cur.length if cur else 0)

    if not target_artist or not target_title:
        return {"synced": False, "lines": [], "plain": "Şarkı bilgisi eksik.", "source": "none"}

    return await lyrics_service.fetch_lyrics(
        artist=target_artist,
        title=target_title,
        album=target_album,
        duration=target_duration
    )

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

@router.get("/sleep-timer")
async def get_sleep_timer(auth: bool = Depends(require_auth)):
    return sleep_timer_service.get_status()

@router.post("/sleep-timer")
async def start_sleep_timer(req: SleepTimerRequest, auth: bool = Depends(require_auth)):
    return sleep_timer_service.start_timer(
        duration_minutes=req.duration_minutes,
        duration_seconds=req.duration_seconds,
        end_of_track=req.end_of_track
    )

@router.delete("/sleep-timer")
async def cancel_sleep_timer(auth: bool = Depends(require_auth)):
    return await sleep_timer_service.cancel_timer()
