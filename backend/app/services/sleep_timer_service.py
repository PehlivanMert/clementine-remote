import asyncio
from typing import Optional, Dict, Any
from ..logging_config import logger

class SleepTimerService:
    def __init__(self, clementine_client=None, ws_manager=None):
        self._client = clementine_client
        self._manager = ws_manager
        self._active = False
        self._remaining_seconds = 0
        self._initial_volume = 100
        self._is_fading = False
        self._task: Optional[asyncio.Task] = None

    def _get_client(self):
        if self._client:
            return self._client
        from ..adapters.clementine.client import clementine_client
        return clementine_client

    def _get_manager(self):
        if self._manager:
            return self._manager
        from ..websocket.manager import manager
        return manager

    def get_status(self) -> Dict[str, Any]:
        return {
            "active": self._active,
            "remaining_seconds": max(0, int(self._remaining_seconds)),
            "initial_volume": self._initial_volume,
            "is_fading": self._is_fading
        }

    def start_timer(self, duration_minutes: Optional[int] = None, duration_seconds: Optional[int] = None, end_of_track: bool = False) -> Dict[str, Any]:
        client = self._get_client()

        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None

        if end_of_track:
            duration = getattr(client.status, "duration", 0)
            position = getattr(client.status, "position", 0)
            remaining = max(10, duration - position)
        elif duration_seconds is not None:
            remaining = duration_seconds
        elif duration_minutes is not None:
            remaining = duration_minutes * 60
        else:
            remaining = 30 * 60

        self._active = True
        self._remaining_seconds = remaining
        self._initial_volume = getattr(client.status, "volume", 100)
        self._is_fading = False

        self._task = asyncio.create_task(self._run_loop())
        self._broadcast_state()

        logger.info(f"Sleep timer started: {remaining}s remaining, initial volume: {self._initial_volume}%")
        return self.get_status()

    async def cancel_timer(self) -> Dict[str, Any]:
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None

        client = self._get_client()
        if self._is_fading:
            try:
                await client.set_volume(self._initial_volume)
            except Exception as e:
                logger.debug(f"Error restoring volume on timer cancel: {e}")

        self._active = False
        self._remaining_seconds = 0
        self._is_fading = False
        self._broadcast_state()

        logger.info("Sleep timer cancelled.")
        return self.get_status()

    async def _run_loop(self):
        client = self._get_client()
        fade_duration = 60.0

        try:
            while self._remaining_seconds > 0:
                await asyncio.sleep(1.0)
                self._remaining_seconds -= 1.0

                # Check if in fade window
                if self._remaining_seconds <= fade_duration:
                    self._is_fading = True
                    ratio = max(0.0, self._remaining_seconds / fade_duration)
                    target_vol = max(0, int(round(self._initial_volume * ratio)))
                    try:
                        await client.set_volume(target_vol)
                    except Exception as e:
                        logger.debug(f"Error fading volume: {e}")
                    self._broadcast_state()
                elif int(self._remaining_seconds) % 5 == 0:
                    self._broadcast_state()

            # Timer reached zero
            logger.info("Sleep timer reached zero. Pausing playback and restoring initial volume...")
            try:
                await client.pause()
                await asyncio.sleep(0.5)
                await client.set_volume(self._initial_volume)
            except Exception as e:
                logger.debug(f"Error during sleep timer completion: {e}")

            self._active = False
            self._is_fading = False
            self._remaining_seconds = 0
            self._broadcast_state()

        except asyncio.CancelledError:
            pass

    def _broadcast_state(self):
        try:
            manager = self._get_manager()
            asyncio.create_task(manager.broadcast("sleep_timer_updated", self.get_status()))
        except Exception:
            pass

sleep_timer_service = SleepTimerService()
