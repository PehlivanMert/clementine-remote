import re
import urllib.parse
from typing import Optional, Dict, Any, List
import httpx
from ..logging_config import logger

class LyricsService:
    def __init__(self, cache_size: int = 500):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_size = cache_size
        self._client = httpx.AsyncClient(timeout=4.0)

    def parse_lrc(self, lrc_text: str) -> List[Dict[str, Any]]:
        """Parse LRC timestamped string into list of {time: float, text: str}."""
        lines = []
        if not lrc_text:
            return lines

        pattern = re.compile(r'\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)')
        for raw_line in lrc_text.splitlines():
            match = pattern.match(raw_line.strip())
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                fraction = match.group(3) or "0"
                if len(fraction) == 2:
                    subsecond = int(fraction) / 100.0
                else:
                    subsecond = int(fraction) / 1000.0
                total_seconds = round(minutes * 60 + seconds + subsecond, 2)
                text = match.group(4).strip()
                lines.append({"time": total_seconds, "text": text})
        return lines

    async def fetch_lyrics(
        self,
        artist: str,
        title: str,
        album: Optional[str] = None,
        duration: Optional[int] = None
    ) -> Dict[str, Any]:
        cache_key = f"{artist.lower().strip()}:{title.lower().strip()}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Primary: LRCLIB API
        try:
            params = {
                "artist_name": artist,
                "track_name": title,
            }
            if album:
                params["album_name"] = album
            if duration and duration > 0:
                params["duration"] = str(duration)

            resp = await self._client.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                synced_lrc = data.get("syncedLyrics")
                plain_lrc = data.get("plainLyrics") or ""

                parsed_lines = self.parse_lrc(synced_lrc) if synced_lrc else []
                is_synced = len(parsed_lines) > 0

                result = {
                    "synced": is_synced,
                    "lines": parsed_lines,
                    "plain": plain_lrc if not is_synced else "\n".join(l["text"] for l in parsed_lines),
                    "source": "lrclib"
                }

                self._store_cache(cache_key, result)
                return result
        except Exception as e:
            logger.debug(f"LRCLIB fetch error for {artist} - {title}: {e}")

        # 2. Return fallback empty result
        empty_res = {
            "synced": False,
            "lines": [],
            "plain": "Bu parça için şarkı sözü bulunamadı.",
            "source": "none"
        }
        self._store_cache(cache_key, empty_res)
        return empty_res

    def _store_cache(self, key: str, value: Dict[str, Any]):
        if len(self._cache) >= self._cache_size:
            oldest = next(iter(self._cache))
            del self._cache[oldest]
        self._cache[key] = value

lyrics_service = LyricsService()
