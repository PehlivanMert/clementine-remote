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
                    url=url_str
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

            if audio:
                if audio.info and hasattr(audio.info, 'length'):
                    length_sec = int(audio.info.length)

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
                is_local=True
            )
        except Exception:
            return None

    def _add_to_indices(self, track: TrackMetadata):
        # Artist index
        art = track.artist or "Unknown Artist"
        if art not in self._artists:
            self._artists[art] = {"name": art, "track_count": 0, "albums": set()}
        self._artists[art]["track_count"] += 1
        if track.album:
            self._artists[art]["albums"].add(track.album)

        # Album index
        alb = track.album or "Unknown Album"
        album_key = f"{art}|||{alb}"
        if album_key not in self._albums:
            self._albums[album_key] = {
                "name": alb,
                "artist": art,
                "year": track.year,
                "track_count": 0,
                "art_available": True
            }
        self._albums[album_key]["track_count"] += 1

    def get_artists(self) -> List[ArtistItem]:
        self.initialize()
        res = []
        for a in sorted(self._artists.values(), key=lambda x: x["name"].lower()):
            res.append(ArtistItem(
                name=a["name"],
                track_count=a["track_count"],
                album_count=len(a["albums"])
            ))
        return res

    def get_albums(self, artist: Optional[str] = None) -> List[AlbumItem]:
        self.initialize()
        res = []
        for k, v in self._albums.items():
            if artist and v["artist"].lower() != artist.lower():
                continue
            res.append(AlbumItem(
                name=v["name"],
                artist=v["artist"],
                year=v["year"],
                track_count=v["track_count"],
                art_available=v["art_available"]
            ))
        return sorted(res, key=lambda x: (x.artist.lower(), x.name.lower()))

    def get_tracks(self, artist: Optional[str] = None, album: Optional[str] = None) -> List[TrackMetadata]:
        self.initialize()
        tracks = self._tracks
        if artist:
            tracks = [t for t in tracks if t.artist.lower() == artist.lower()]
        if album:
            tracks = [t for t in tracks if t.album.lower() == album.lower()]
        return tracks

    def search(self, query: str) -> SearchResults:
        self.initialize()
        q = query.strip().lower()
        if not q:
            return SearchResults(query=query)

        matched_artists: List[ArtistItem] = []
        for a in self.get_artists():
            if q in a.name.lower():
                matched_artists.append(a)

        matched_albums: List[AlbumItem] = []
        for alb in self.get_albums():
            if q in alb.name.lower() or q in alb.artist.lower():
                matched_albums.append(alb)

        matched_tracks: List[TrackMetadata] = []
        for t in self._tracks:
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
