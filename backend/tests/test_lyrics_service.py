import pytest
from backend.app.services.lyrics_service import LyricsService

def test_parse_lrc_timestamps():
    service = LyricsService()
    lrc_text = """[00:12.50] Hello darkness my old friend
[00:15.80] I've come to talk with you again
[01:02.15] Because a vision softly creeping
"""
    lines = service.parse_lrc(lrc_text)
    assert len(lines) == 3
    assert lines[0]["time"] == 12.5
    assert lines[0]["text"] == "Hello darkness my old friend"
    assert lines[1]["time"] == 15.8
    assert lines[2]["time"] == 62.15

def test_empty_or_plain():
    service = LyricsService()
    lines = service.parse_lrc("Just plain lyrics without timestamps\nAnother line")
    assert len(lines) == 0

@pytest.mark.anyio
async def test_cache_mechanism():
    service = LyricsService()
    service._cache["test_artist:test_title"] = {
        "synced": True,
        "lines": [{"time": 1.0, "text": "cached line"}],
        "plain": "cached line",
        "source": "cache"
    }
    res = await service.fetch_lyrics(artist="test_artist", title="test_title")
    assert res["synced"] is True
    assert res["lines"][0]["text"] == "cached line"
