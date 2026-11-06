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
  - `CloudflareWARP`: 172.16.0.2/32 (VPN tunnel - must NOT be exposed as iPhone access IP)
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
    - Clearing playlist is supported via `MsgType.UPDATE_PLAYLIST` (60) with `RequestUpdatePlaylist.clear_playlist = true`.
- **Library Database Inspection**:
  - `~/.config/Clementine/clementine.db` contains SQLite schema with tables `songs`, `playlists`, `playlist_items`.
  - User's existing playlist "Çalma Listesi 1" (id: 3) contains 7 active tracks.
  - User's music directory at `/home/mert/Müzik` contains 1,139 tracks (FLAC, MP3, etc.).

## Phase 2: Protocol Validation & Live Testing
- Successfully compiled `remotecontrolmessages.proto` (version 23) using `grpc_tools.protoc`.
- Updated `~/.config/Clementine/Clementine.conf` to set `use_remote=true` (keeping original backup at `Clementine.conf.orig.bak`).
- Launched Clementine 1.4 RC2 and verified port 5500 listening (`ss -tlpn | grep 5500`).
- Validated connection behavior:
  - Connecting via IPv4 loopback `127.0.0.1` maps to `::ffff:127.0.0.1` in Qt, which causes `isLoopback()` to return false and Clementine to reject with `Not_Local_Network`.
  - Connecting via `172.20.5.94` (the active Wi-Fi LAN IP in `172.16.0.0/12`) or IPv6 `::1` is recognized as local network client and immediately accepted.
- Successfully validated handshake: `CONNECT` -> `INFO` -> `CURRENT_METAINFO` (received 90,830 bytes JPEG art) -> `PLAYLISTS` -> `PLAYLIST_SONGS` (7 songs from user's "Çalma Listesi 1") -> `SET_VOLUME` -> `SHUFFLE` -> `REPEAT` -> `FIRST_DATA_SENT_COMPLETE`.
- Successfully tested commands: `PLAY`, `PAUSE`, `SET_VOLUME` (75%), `CHANGE_SONG`, `INSERT_URLS`, `REMOVE_SONGS`, and `UPDATE_PLAYLIST`.

## Phase 3: Backend Implementation & Hardening
- Built FastAPI backend under `backend/app/`:
  - `adapters/clementine/`: Async TCP protocol client with 4-byte big-endian framing, automatic reconnection with backoff, state parsing, thread-safe command dispatch, and playlist management (`clear_playlist`, `update_playlist`, `insert_urls`, `remove_songs`).
  - Added automatic fallback to `active_playlist_id` for all playlist modifications.
  - `websocket/manager.py`: WebSocket broadcast manager streaming state changes (`track_changed`, `state_changed`, `position_changed`, `volume_changed`, `playlist_songs_updated`, `playlists_updated`) to web clients, with 15s ping/pong keepalive for mobile Safari.
  - **Secure WebSocket Authentication**: Verifies JWT token from query param or session cookie; rejects unauthorized connections with code 1008 (Policy Violation).
  - **Login Rate Limiter**: Sliding-window rate limiter blocking brute-force attacks (max 5 failed attempts per 60s per client IP) with HTTP 429 Retry-After responses.
  - **Robust LAN IP Detection**: Added interface-based detection ignoring VPN tunnels (CloudflareWARP `172.16.0.2`) and Docker bridges (`172.17.0.1`), ensuring correct resolution of local Wi-Fi `172.20.5.94`.
  - **Strict Production CORS**: Replaced wildcard `*` with explicit localhost and local LAN IP origins.
  - `services/library_service.py`: Enriched with `sample_track_url` for albums to enable real cover thumbnails across library browsing.
  - `services/artwork_service.py`: In-memory & disk caching of album artwork with Pillow thumbnail generation and stylish SVG fallback.
  - Added `pytest.ini` with `pythonpath = .` and updated all backend tests.

## Phase 4 & 5: Frontend & PWA Implementation
- Built mobile-first React 18 + TypeScript + Tailwind CSS application styled in Dark Hi-Fi aesthetic:
  - `NowPlaying`: Large album artwork with glow, title/artist/album, interactive progress scrubber with pointer events and snap-back protection, hero round amber play/pause button, shuffle/repeat toggles, volume slider with discrete Volume Up (+5%) and Volume Down (-5%) buttons, and smart mute (restores exact previous volume).
  - `PlaylistView`: Queue management with album artwork thumbnails on each track, touch-accessible remove button (no hover requirement), active track badge with animated equalizer, tap to play, and **Clear Queue** button with modal confirmation.
  - `LibraryView`: Tabs for Artists, Albums, and Tracks; album cards render real artwork thumbnails with fallback; drill-down track list with "Play All" and "Add to Queue" targeting the real active playlist ID.
  - `SearchView`: 250ms debounced search categorizing matches into Artists, Albums, and Songs, with artwork thumbnails and active playlist ID targeting.
  - `SystemView`: Displays real Wi-Fi LAN IP (`172.20.5.94`), iPhone URL, Clementine connection status, and iOS Home Screen PWA setup guide.
  - `sw.js` (Service Worker): Provides PWA offline app shell caching and network fallback for standalone iPhone Safari mode.
  - `manifest.webmanifest` & custom SVG and PNG icons (192px, 512px) for iPhone Safari standalone mode.
- Frontend production bundle built cleanly into `frontend/dist` (1.64s).
- Full Vitest frontend unit test suite added (14 tests in 4 test suites).

## Phase 6 & 7: Testing, Deployment & Verification
- Unit & Integration Tests:
  - 13 backend tests passed in `test_backend.py` and `test_player_api.py`.
  - 14 frontend unit tests passed in Vitest (`NowPlaying`, `PlaylistView`, `LibraryView`, `SearchView`).
- Browser End-to-End Tests:
  - Headless Chromium with Playwright emulating **iPhone 14 Pro** viewport & touch (`test_e2e_browser.py`).
  - Tested: login unlock, Now Playing render, Volume Up click, Queue navigation with Clear Queue modal cancel, Library albums with real cover artwork, Artists subtab, debounced search query ("Pink"), and System info with verified `172.20.5.94`.
  - All 7 screenshots verified and saved in `screenshots/`.
  - Full automated suite: 13 backend tests + 14 frontend unit tests + Playwright E2E passed cleanly.
