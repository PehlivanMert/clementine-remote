# Development Log — Clementine Web Remote

## Phase 1: Environment & Protocol Research
- **Date**: 2026-11-07
- **Host**: Linux vittoria-sara-nostra 7.0.0-42-generic x86_64 Ubuntu 26.04.1 LTS
- **Clementine**: 1.4 rc2 (/usr/bin/clementine)
- **Python**: 3.14.4
- **Node**: v22.23.3, npm 10.9.9
- **Network Interface**:
  - `wlo1`: 172.20.5.94/19 (Local Wi-Fi LAN, iPhone accessible)
  - `lo`: 127.0.0.1/8
  - `docker0`: 172.17.0.1/16
  - `CloudflareWARP`: 172.16.0.2/32
- **Clementine Config Inspection**:
  - Found config at `~/.config/Clementine/Clementine.conf`.
  - `[NetworkRemote]` section: `port=5500`, `use_remote=false`, `auth_code=77954`, `use_auth_code=false`.
- **Protocol Research & Verification**:
  - Official protobuf schema downloaded from Clementine repository: `proto/remotecontrolmessages.proto`.
  - Wire framing verified from Clementine C++ source (`networkremote.cpp`, `remoteclient.cpp`):
    - Each message starts with a 4-byte big-endian integer representing the length of the protobuf payload (`QDataStream << qint32(len)`).
    - Maximum allowed message length is 128 MB (134217728 bytes).
    - Protocol sniffer checks first byte: `<= 0x08` is remote control protobuf; `>= 'A'` is HTTP.
    - Initial handshake: Client connects and sends `RequestConnect` (type `CONNECT`, version `23`).
    - Server responds with `INFO`, `CURRENT_METAINFO`, `PLAYLISTS`, `PLAYLIST_SONGS`, `REPEAT`, `SHUFFLE`, followed by `FIRST_DATA_SENT_COMPLETE`.
    - Server streams `UPDATE_TRACK_POSITION` every 1 second during playback, `SET_VOLUME` on volume change, and `CURRENT_METAINFO` with embedded JPEG artwork when song changes.
- **Library Database Inspection**:
  - `~/.config/Clementine/clementine.db` contains SQLite schema with tables `songs`, `playlists`, `playlist_items`.
  - User's existing playlist "Çalma Listesi 1" (id: 3) contains 7 active tracks.
  - User's music directory at `/home/mert/Müzik` contains 1,139 tracks (FLAC, MP3, etc.).

## Phase 2: Protocol Validation & Live Testing
- Successfully compiled `remotecontrolmessages.proto` (version 23) using `grpc_tools.protoc`.
- Updated `~/.config/Clementine/Clementine.conf` to set `use_remote=true` (keeping original backup at `Clementine.conf.orig.bak`).
- Launched Clementine 1.4 RC2 and verified port 5500 listening (`ss -tlpn | grep 5500`).
- Discovered and addressed Clementine 1.4 RC2 dual-stack check behavior:
  - Clementine inspects incoming peer IPs with `IsLocalClient`. Connecting via IPv4 loopback `127.0.0.1` maps to `::ffff:127.0.0.1` in Qt, which causes `isLoopback()` to return false and Clementine to reject with `Not_Local_Network`.
  - Connecting via `172.20.5.94` (the active Wi-Fi LAN IP in `172.16.0.0/12`) or IPv6 `::1` is recognized as local network client and immediately accepted.
  - Successfully validated handshake: `CONNECT` -> `INFO` -> `CURRENT_METAINFO` (received 90,830 bytes JPEG art) -> `PLAYLISTS` -> `PLAYLIST_SONGS` (7 songs from user's "Çalma Listesi 1") -> `SET_VOLUME` -> `SHUFFLE` -> `REPEAT` -> `FIRST_DATA_SENT_COMPLETE`.
  - Successfully tested commands: `PLAY`, `PAUSE`, `SET_VOLUME` (75%), `CHANGE_SONG`, `INSERT_URLS`, and `REMOVE_SONGS`.

## Phase 3: Backend Implementation
- Built FastAPI backend under `backend/app/`:
  - `adapters/clementine/`: Async TCP protocol client with 4-byte big-endian framing, automatic reconnection with backoff, state parsing, and thread-safe command dispatch.
  - `websocket/manager.py`: WebSocket broadcast manager streaming state changes (`track_changed`, `state_changed`, `position_changed`, `volume_changed`, `playlist_songs_updated`, `playlists_updated`) to web clients, with 15s ping/pong keepalive for mobile Safari.
  - `services/library_service.py`: Read-only queries from `clementine.db` (`songs` table) with fallback mutagen indexing of `/home/mert/Müzik` (1,139 tracks).
  - `services/artwork_service.py`: In-memory & disk caching of album artwork with Pillow thumbnail generation and stylish SVG fallback.
  - `security.py` & `api/auth.py`: Password protection ("clementine"), JWT bearer token, and HTTP-only cookie support.
  - `api/player.py`, `api/playlist.py`, `api/library.py`, `api/artwork.py`, `api/system.py`.

## Phase 4 & 5: Frontend & PWA Implementation
- Built mobile-first React 18 + TypeScript + Tailwind CSS application styled in Dark Hi-Fi aesthetic:
  - `NowPlaying`: Large album artwork with glow, title/artist/album, interactive progress scrubber, hero round amber play/pause button, shuffle/repeat toggles, volume slider with mute.
  - `PlaylistView`: Queue management, active track badge with animated equalizer, tap to play, track remove button.
  - `LibraryView`: Tabs for Artists, Albums, and Tracks, album cards, drill-down track list with "Play All" and "Add to Queue".
  - `SearchView`: 250ms debounced search categorizing matches into Artists, Albums, and Songs.
  - `SystemView`: Displays LAN IP (`172.20.5.94`), iPhone URL, Clementine connection status, and iOS Home Screen PWA setup guide.
  - `LoginModal`: Glassmorphism password modal for first-time access.
  - `manifest.webmanifest` & custom SVG and PNG icons (192px, 512px) for iPhone Safari standalone mode.
- Frontend production bundle built cleanly into `frontend/dist` (1.61s).

## Phase 6 & 7: Testing, Deployment & Verification
- Unit & Integration Tests:
  - 8 backend tests passed in `test_backend.py` and `test_player_api.py`.
- Browser End-to-End Tests:
  - Headless Chromium with Playwright emulating **iPhone 14 Pro** viewport & touch (`test_e2e_browser.py`).
  - Tested: login unlock, Now Playing render, Queue navigation, Library albums and artists tabs, debounced search query ("Pink"), and System info.
  - All 7 screenshots verified and saved in `screenshots/`.
  - Full test suite passed (9/9 passed in 12.83s).
- Production Scripts & Service:
  - `install.sh`: Full automated installer.
  - `start.sh`: Launcher verifying Clementine and starting Web Remote.
  - `stop.sh`: Clean shutdown script.
  - `update.sh`: Updater script.
  - `systemd/clementine-web-remote.service`: User systemd service unit.
  - `.env.example`: Configuration template.
  - `README.md`: Comprehensive documentation covering installation, configuration, iPhone Safari usage, adding to Home Screen, updating, and troubleshooting.
