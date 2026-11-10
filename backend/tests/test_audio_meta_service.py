import os
import pytest
from backend.app.services.audio_meta_service import AudioMetaService

def test_probe_flac_hi_res():
    service = AudioMetaService()
    test_path = "/home/mert/Müzik/FLAC/Elektronik & Dans/Mahmut Orhan/3 (2026) [24Bit Hi-Res]/01. Mahmut Orhan - Inci.flac"
    if os.path.exists(test_path):
        meta = service.probe_file(test_path)
        assert meta is not None
        assert meta["audio_format"] == "FLAC"
        assert meta["bit_depth"] == 24
        assert meta["sample_rate"] == 44100
        assert meta["is_hi_res"] is True

def test_probe_mp3():
    service = AudioMetaService()
    test_path = "/home/mert/Müzik/MP3/Elektronik, Afro House & Dans/Palm Monkey & RUSSI & The Palm Tree Boy - AWGAZI.mp3"
    if os.path.exists(test_path):
        meta = service.probe_file(test_path)
        assert meta is not None
        assert meta["audio_format"] == "MP3"
        assert meta["bit_rate"] >= 315000
        assert meta["is_hi_res"] is False

def test_probe_non_existent():
    service = AudioMetaService()
    meta = service.probe_file("/non/existent/path.flac")
    assert meta is None

def test_clean_file_uri():
    service = AudioMetaService()
    path = service.clean_path("file:///home/mert/M%C3%BCzik/test.flac")
    assert path == "/home/mert/Müzik/test.flac"
