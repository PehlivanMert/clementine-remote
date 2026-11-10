import pytest
from unittest.mock import AsyncMock
from backend.app.services.sleep_timer_service import SleepTimerService

@pytest.mark.anyio
async def test_sleep_timer_lifecycle():
    timer = SleepTimerService()
    mock_client = AsyncMock()
    mock_client.status.volume = 88
    mock_client.status.duration = 240
    mock_client.status.position = 40
    timer._client = mock_client

    state = timer.start_timer(duration_minutes=15)
    assert state["active"] is True
    assert state["remaining_seconds"] == 15 * 60
    assert state["initial_volume"] == 88
    assert state["is_fading"] is False

    status = timer.get_status()
    assert status["active"] is True

    cancelled = await timer.cancel_timer()
    assert cancelled["active"] is False
    assert timer._task is None

@pytest.mark.anyio
async def test_sleep_timer_end_of_track():
    timer = SleepTimerService()
    mock_client = AsyncMock()
    mock_client.status.volume = 75
    mock_client.status.duration = 200
    mock_client.status.position = 50
    timer._client = mock_client

    state = timer.start_timer(end_of_track=True)
    assert state["active"] is True
    assert state["remaining_seconds"] == 150  # 200 - 50
    await timer.cancel_timer()
