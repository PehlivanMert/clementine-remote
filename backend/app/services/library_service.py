import os
import sqlite3
import urllib.parse
from pathlib import Path
from typing import List, Optional, Dict
import mutagen
from ..models.library import ArtistItem, AlbumItem, SearchResults
from ..models.player import TrackMetadata
from ..config import settings
import logging

logger = logging.getLogger("library_service")

class LibraryService:
    def __init__(self):
        self.db_path = settings.CLEMENTINE_DB_PATH
        self.music_dir = settings.MUSIC_DIR
        self._tracks: List[TrackMetadata] = []
        self._artists: Dict[str, Dict] = {}
        self._albums: Dict[str, Dict] = {}
        self._indexed = False

    def initialize(self):
        """Index the library from Clementine DB or music folder."""
        if self._indexed:
            return

        # 1. Try reading from Clementine DB
        loaded_from_db = self._load_from_clementine_db()

        # 2. If DB has no songs or unavailable, scan MUSIC_DIR
        if not loaded_from_db or len(self._tracks) == 0:
            self._scan_music_directory()

        self._indexed = True
        logger.info(f"Library initialized: {len(self._tracks)} tracks, {len(self._artists)} artists, {len(self._albums)} albums.")

    def _load_from_clementine_db(self) -> bool:
        if not os.path.exists(self.db_path):
            return False

        try:
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            cur = conn.cursor()
            cur.execute("""
                SELECT rowid, title, artist, album, albumartist, track, disc, length, year, genre, filename
                FROM songs
                WHERE unavailable = 0
                ORDER BY artist, album, track, title;
            """)
            rows = cur.fetchall()
            conn.close()

            if not rows:
                return False

            self._tracks = []
            self._artists = {}
            self._albums = {}

            for idx, r in enumerate(rows):
                rowid, title, artist, album, albumartist, track, disc, length_nanosec, year, genre, filename = r
                length_sec = int(length_nanosec / 1_000_000_000) if length_nanosec else 0
                m, s = divmod(length_sec, 60)
                pretty_len = f"{m}:{s:02d}"

                url_str = ""
                if filename:
                    url_str = filename.decode('utf-8', errors='ignore') if isinstance(filename, bytes) else str(filename)

                audio_fmt = None
                if url_str:
                    path_clean = urllib.parse.unquote(url_str)
                    ext = os.path.splitext(path_clean)[1].lower().replace('.', '')
                    if ext in ('flac', 'mp3', 'm4a', 'aac', 'wav', 'ogg'):
                        audio_fmt = 'AAC' if ext in ('m4a', 'aac') else ext.upper()

                track_meta = TrackMetadata(
                    id=rowid,
                    index=idx,
                    title=title or "Unknown Title",
                    artist=artist or "Unknown Artist",
                    album=album or "Unknown Album",
                    albumartist=albumartist or "",
                    track=track or 0,
                    disc=disc or 0,
                    length=length_sec,
                    pretty_length=pretty_len,
                    year=str(year) if year else "",
                    genre=genre or "",
                    is_local=True,
                    url=url_str,
                    audio_format=audio_fmt
                )
                self._tracks.append(track_meta)
                self._add_to_indices(track_meta)

            return True
        except Exception as e:
            logger.warning(f"Could not load songs from clementine.db: {e}")
            return False

    def _scan_music_directory(self):
        """Scan the local music folder as fallback."""
        if not os.path.exists(self.music_dir):
            return

        supported_exts = ('.mp3', '.flac', '.ogg', '.m4a', '.wav')
        self._tracks = []
        self._artists = {}
        self._albums = {}
        idx = 0

        for root, _, files in os.walk(self.music_dir):
            for file in files:
                if file.lower().endswith(supported_exts):
                    file_path = os.path.join(root, file)
                    track_meta = self._parse_file(file_path, idx)
                    if track_meta:
                        self._tracks.append(track_meta)
                        self._add_to_indices(track_meta)
                        idx += 1

    def _parse_file(self, file_path: str, index: int) -> Optional[TrackMetadata]:
        try:
            audio = mutagen.File(file_path, easy=True)
            title = Path(file_path).stem
            artist = "Unknown Artist"
            album = "Unknown Album"
            track_num = 0
            year = ""
            genre = ""
            length_sec = 0

            ext = os.path.splitext(file_path)[1].lower().replace('.', '')
            audio_format = 'AAC' if ext in ('m4a', 'aac') else ext.upper() if ext else None
            bit_depth = None
            sample_rate = None
            bit_rate = None
            is_hi_res = False

            if audio:
                if audio.info:
                    if hasattr(audio.info, 'length') and audio.info.length:
                        length_sec = int(audio.info.length)
                    if hasattr(audio.info, 'sample_rate') and audio.info.sample_rate:
                        sample_rate = int(audio.info.sample_rate)
                    if hasattr(audio.info, 'bits_per_sample') and audio.info.bits_per_sample:
                        bit_depth = int(audio.info.bits_per_sample)
                    if hasattr(audio.info, 'bitrate') and audio.info.bitrate:
                        bit_rate = int(audio.info.bitrate / 1000)

                is_hi_res = (bit_depth is not None and bit_depth > 16) or (sample_rate is not None and sample_rate > 48000)

                tags = audio.tags or {}
                if 'title' in tags and tags['title']:
                    title = tags['title'][0]
                if 'artist' in tags and tags['artist']:
                    artist = tags['artist'][0]
                if 'album' in tags and tags['album']:
                    album = tags['album'][0]
                if 'tracknumber' in tags and tags['tracknumber']:
                    try:
                        track_num = int(str(tags['tracknumber'][0]).split('/')[0])
                    except ValueError:
                        pass
                if 'date' in tags and tags['date']:
                    year = str(tags['date'][0])
                if 'genre' in tags and tags['genre']:
                    genre = tags['genre'][0]

            m, s = divmod(length_sec, 60)
            pretty_len = f"{m}:{s:02d}"
            url_str = "file://" + urllib.parse.quote(file_path)

            return TrackMetadata(
                id=index + 1,
                index=index,
                title=title,
                artist=artist,
                album=album,
                track=track_num,
                length=length_sec,
                pretty_length=pretty_len,
                year=year,
                genre=genre,
                filename=os.path.basename(file_path),
                url=url_str,
                is_local=True,
                audio_format=audio_format,
                bit_depth=bit_depth,
                sample_rate=sample_rate,
                bit_rate=bit_rate,
                is_hi_res=is_hi_res
            )
        except Exception:
            return None

    def _add_to_indices(self, track: TrackMetadata):
        # Artist index
        art = track.artist or "Unknown Artist"
        if art not in self._artists:
            self._artists[art] = {"name": art, "track_count": 0, "albums": set(), "formats": set()}
        self._artists[art]["track_count"] += 1
        if track.album:
            self._artists[art]["albums"].add(track.album)
        if track.audio_format:
            self._artists[art]["formats"].add(track.audio_format)

        # Album index
        alb = track.album or "Unknown Album"
        album_key = f"{art}|||{alb}"
        if album_key not in self._albums:
            self._albums[album_key] = {
                "name": alb,
                "artist": art,
                "year": track.year,
                "track_count": 0,
                "art_available": True,
                "sample_track_url": track.url or "",
                "formats": set()
            }
        elif not self._albums[album_key].get("sample_track_url") and track.url:
            self._albums[album_key]["sample_track_url"] = track.url
        self._albums[album_key]["track_count"] += 1
        if track.audio_format:
            self._albums[album_key]["formats"].add(track.audio_format)

    def get_artists(self, format: Optional[str] = None) -> List[ArtistItem]:
        self.initialize()
        res = []
        f_upper = format.upper() if format else None
        for a in sorted(self._artists.values(), key=lambda x: x["name"].lower()):
            formats_list = sorted(list(a.get("formats", set())))
            if f_upper:
                if f_upper in ("HI-RES", "HIRES"):
                    if not any(t.is_hi_res for t in self.get_tracks(artist=a["name"])):
                        continue
                elif f_upper not in [f.upper() for f in formats_list]:
                    continue

            res.append(ArtistItem(
                name=a["name"],
                track_count=a["track_count"],
                album_count=len(a["albums"]),
                formats=formats_list
            ))
        return res

    def get_albums(self, artist: Optional[str] = None, format: Optional[str] = None) -> List[AlbumItem]:
        self.initialize()
        res = []
        f_upper = format.upper() if format else None
        for k, v in self._albums.items():
            if artist and v["artist"].lower() != artist.lower():
                continue
            formats_list = sorted(list(v.get("formats", set())))
            if f_upper:
                if f_upper in ("HI-RES", "HIRES"):
                    if not any(t.is_hi_res for t in self.get_tracks(v["artist"], v["name"])):
                        continue
                elif f_upper not in [f.upper() for f in formats_list]:
                    continue

            res.append(AlbumItem(
                name=v["name"],
                artist=v["artist"],
                year=v["year"],
                track_count=v["track_count"],
                art_available=v["art_available"],
                sample_track_url=v.get("sample_track_url", ""),
                formats=formats_list
            ))
        return sorted(res, key=lambda x: (x.artist.lower(), x.name.lower()))

    def get_tracks(
        self,
        artist: Optional[str] = None,
        album: Optional[str] = None,
        format: Optional[str] = None
    ) -> List[TrackMetadata]:
        self.initialize()
        tracks = self._tracks
        if artist:
            tracks = [t for t in tracks if t.artist.lower() == artist.lower()]
        if album:
            tracks = [t for t in tracks if t.album.lower() == album.lower()]
        if format:
            f_upper = format.upper()
            if f_upper in ("HI-RES", "HIRES"):
                tracks = [t for t in tracks if t.is_hi_res]
            else:
                tracks = [t for t in tracks if (t.audio_format or "").upper() == f_upper]
        return tracks

    def search(self, query: str, format: Optional[str] = None) -> SearchResults:
        self.initialize()
        q = query.strip().lower()
        if not q:
            return SearchResults(query=query)

        matched_artists: List[ArtistItem] = []
        for a in self.get_artists(format=format):
            if q in a.name.lower():
                matched_artists.append(a)

        matched_albums: List[AlbumItem] = []
        for alb in self.get_albums(format=format):
            if q in alb.name.lower() or q in alb.artist.lower():
                matched_albums.append(alb)

        matched_tracks: List[TrackMetadata] = []
        for t in self.get_tracks(format=format):
            if q in t.title.lower() or q in t.artist.lower() or q in t.album.lower():
                matched_tracks.append(t)
                if len(matched_tracks) >= 100:  # Cap at 100 results for speed
                    break

        return SearchResults(
            query=query,
            artists=matched_artists[:20],
            albums=matched_albums[:20],
            tracks=matched_tracks
        )

library_service = LibraryService()
