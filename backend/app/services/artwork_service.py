import os
import io
import hashlib
from typing import Optional
from pathlib import Path
from PIL import Image
import mutagen
from ..adapters.clementine.client import clementine_client
from ..config import settings

class ArtworkService:
    def __init__(self):
        self.cache_dir = Path(settings.ARTWORK_CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._memory_cache: dict[str, bytes] = {}

    def get_current_artwork(self, thumbnail: bool = False) -> Optional[bytes]:
        """Return the artwork bytes for the currently playing song."""
        raw_art = clementine_client.current_art
        if not raw_art:
            # Fallback to current track's file path if available
            track = clementine_client.status.current_track
            if track and track.url and track.url.startswith("file://"):
                file_path = track.url[7:]
                # URL unquote if needed
                import urllib.parse
                file_path = urllib.parse.unquote(file_path)
                return self.get_file_artwork(file_path, thumbnail=thumbnail)
            return None

        if thumbnail:
            cache_key = "current_thumb"
            if cache_key in self._memory_cache:
                return self._memory_cache[cache_key]
            thumb = self._resize_image(raw_art, size=(160, 160))
            self._memory_cache[cache_key] = thumb
            return thumb

        return raw_art

    def get_file_artwork(self, file_path: str, thumbnail: bool = False) -> Optional[bytes]:
        """Extract artwork from an audio file or its directory (cover.jpg/folder.jpg)."""
        if not file_path or not os.path.exists(file_path):
            return None

        file_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()
        cache_key = f"{file_hash}_thumb" if thumbnail else file_hash

        if cache_key in self._memory_cache:
            return self._memory_cache[cache_key]

        cached_file = self.cache_dir / f"{cache_key}.jpg"
        if cached_file.exists():
            data = cached_file.read_bytes()
            self._memory_cache[cache_key] = data
            return data

        # 1. Try extracting with mutagen
        art_bytes = self._extract_mutagen_art(file_path)

        # 2. Try looking for cover images in the same directory
        if not art_bytes:
            parent_dir = Path(file_path).parent
            for cover_name in ['cover.jpg', 'cover.png', 'folder.jpg', 'front.jpg', 'albumart.jpg']:
                candidate = parent_dir / cover_name
                if candidate.exists():
                    try:
                        art_bytes = candidate.read_bytes()
                        break
                    except Exception:
                        pass

        if not art_bytes:
            return None

        # Resize if thumbnail
        if thumbnail:
            art_bytes = self._resize_image(art_bytes, size=(160, 160))

        try:
            cached_file.write_bytes(art_bytes)
        except Exception:
            pass

        self._memory_cache[cache_key] = art_bytes
        return art_bytes

    def _extract_mutagen_art(self, file_path: str) -> Optional[bytes]:
        try:
            audio = mutagen.File(file_path)
            if not audio:
                return None

            # ID3 (MP3)
            if hasattr(audio, 'tags') and audio.tags:
                for key in audio.tags.keys():
                    if key.startswith('APIC'):
                        return audio.tags[key].data

            # FLAC
            if hasattr(audio, 'pictures') and audio.pictures:
                return audio.pictures[0].data

            return None
        except Exception:
            return None

    def _resize_image(self, data: bytes, size=(160, 160)) -> bytes:
        try:
            im = Image.open(io.BytesIO(data))
            im.thumbnail(size, Image.Resampling.LANCZOS)
            if im.mode in ("RGBA", "P"):
                im = im.convert("RGB")
            out = io.BytesIO()
            im.save(out, format="JPEG", quality=85)
            return out.getvalue()
        except Exception:
            return data

artwork_service = ArtworkService()
