import os
import urllib.parse
from typing import Optional, Dict, Any
from functools import lru_cache
import mutagen
from mutagen.flac import FLAC
from mutagen.mp3 import MP3

class AudioMetaService:
    def __init__(self, cache_size: int = 500):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_size = cache_size

    def clean_path(self, raw_path: Optional[str]) -> Optional[str]:
        if not raw_path:
            return None
        path = str(raw_path).strip()
        if path.startswith("file://"):
            path = path[7:]
        path = urllib.parse.unquote(path)
        return path

    def probe_file(self, raw_path: Optional[str]) -> Optional[Dict[str, Any]]:
        path = self.clean_path(raw_path)
        if not path or not os.path.exists(path) or not os.path.isfile(path):
            return None

        if path in self._cache:
            return self._cache[path]

        try:
            audio = mutagen.File(path)
            if audio is None or audio.info is None:
                return None

            format_name = "UNKNOWN"
            bit_depth: Optional[int] = None
            sample_rate: Optional[int] = getattr(audio.info, "sample_rate", None)
            bit_rate: Optional[int] = getattr(audio.info, "bitrate", None)

            if isinstance(audio, FLAC):
                format_name = "FLAC"
                bit_depth = getattr(audio.info, "bits_per_sample", 16)
            elif isinstance(audio, MP3):
                format_name = "MP3"
                bit_depth = 16
            else:
                ext = os.path.splitext(path)[1].lower().lstrip(".")
                format_name = ext.upper() if ext else "AUDIO"
                bit_depth = getattr(audio.info, "bits_per_sample", None)

            is_hi_res = False
            if bit_depth and bit_depth >= 24:
                is_hi_res = True
            elif sample_rate and sample_rate >= 88200:
                is_hi_res = True

            result = {
                "audio_format": format_name,
                "bit_depth": bit_depth,
                "sample_rate": sample_rate,
                "bit_rate": bit_rate,
                "is_hi_res": is_hi_res
            }

            if len(self._cache) >= self._cache_size:
                # Evict oldest entry
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
            self._cache[path] = result

            return result
        except Exception:
            return None

audio_meta_service = AudioMetaService()
