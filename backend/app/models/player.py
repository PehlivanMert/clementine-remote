from typing import Optional
from pydantic import BaseModel

class TrackMetadata(BaseModel):
    id: Optional[int] = None
    index: int = 0
    title: str = ""
    artist: str = ""
    album: str = ""
    albumartist: Optional[str] = ""
    track: Optional[int] = 0
    disc: Optional[int] = 0
    length: int = 0  # in seconds
    pretty_length: str = "0:00"
    year: Optional[str] = ""
    genre: Optional[str] = ""
    is_local: bool = True
    filename: Optional[str] = ""
    url: Optional[str] = ""
    has_art: bool = False
    audio_format: Optional[str] = None
    bit_depth: Optional[int] = None
    sample_rate: Optional[int] = None
    bit_rate: Optional[int] = None
    is_hi_res: bool = False

class PlayerStatus(BaseModel):
    state: str = "Idle"  # "Playing", "Paused", "Idle", "Empty"
    current_track: Optional[TrackMetadata] = None
    position: int = 0  # current position in seconds
    duration: int = 0  # duration in seconds
    volume: int = 100  # 0 to 100
    repeat_mode: int = 0  # 0: Off, 1: Track, 2: Album, 3: Playlist, 4: OneByOne, 5: Intro
    shuffle_mode: int = 0  # 0: Off, 1: All, 2: InsideAlbum, 3: Albums
    clementine_connected: bool = False
    clementine_version: str = ""

class VolumeCommand(BaseModel):
    volume: int

class SeekCommand(BaseModel):
    position: int

class ShuffleCommand(BaseModel):
    mode: int

class RepeatCommand(BaseModel):
    mode: int

class SleepTimerRequest(BaseModel):
    duration_minutes: Optional[int] = None
    duration_seconds: Optional[int] = None
    end_of_track: bool = False
