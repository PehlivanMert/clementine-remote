# Tasks Checklist — Clementine Web Remote

## Phase 1: Environment & Protocol Research
- [x] Inspect Ubuntu version, Python (3.14.4), Node (v22.23.3), Clementine (1.4 RC2).
- [x] Determine actual Wi-Fi LAN interface (`wlo1` on `172.20.5.94/19`).
- [x] Inspect `~/.config/Clementine/Clementine.conf` settings (`use_remote=false`, `port=5500`, `auth_code=77954`).
- [x] Download official protobuf definition `remotecontrolmessages.proto` (v23).
- [x] Verify wire framing: 4-byte big-endian length prefix followed by protobuf payload.
- [x] Download & inspect Clementine C++ source: `networkremote.cpp`, `remoteclient.cpp`, `incomingdataparser.cpp`, `outgoingdatacreator.cpp`.

## Phase 2: Protocol Validation & Test Client
- [x] Compile `.proto` to Python bindings (`remotecontrolmessages_pb2.py`).
- [x] Enable `use_remote=true` in `Clementine.conf` (with backup).
- [x] Start Clementine and verify port 5500 listening.
- [x] Write standalone protocol test verifying:
  - [x] CONNECT message (auth_code=77954).
  - [x] INFO and FIRST_DATA_SENT_COMPLETE receipt.
  - [x] CURRENT_METAINFO and album art bytes (90,830 bytes JPEG verified).
  - [x] PLAYLISTS and PLAYLIST_SONGS receipt.
  - [x] Play, Pause, Volume (75%), and Track change verified.
  - [x] INSERT_URLS (added track) and REMOVE_SONGS (restored playlist) verified.
  - [x] Verified connection behavior: connecting over `::1` or `172.20.5.94` works cleanly.

## Phase 3: Backend Implementation (FastAPI + Asyncio)
- [x] Implement Clementine TCP protocol client (`backend/app/adapters/clementine/`).
  - [x] Wire framing (4-byte big endian header).
  - [x] Reconnection and keep-alive handling.
  - [x] State tracking (player state, current track, volume, playlist, repeat/shuffle).
  - [x] Album art cache (serving memory/disk cached JPEG).
  - [x] Playlist management: `clear_playlist` (via `RequestUpdatePlaylist(clear_playlist=True)`), `update_playlist`, `insert_urls`, `remove_songs`.
  - [x] Automatic fallback to `active_playlist_id` for all playlist modifications.
- [x] Implement WebSocket manager for real-time state broadcast.
- [x] Secure WebSocket authentication: token verification via query param/cookie with WS 1008 rejection for unauthenticated clients.
- [x] Rate limiting: in-memory sliding window rate limiter on `/api/auth/login` (max 5 failed attempts per 60s per client IP).
- [x] Safe CORS configuration: remove wildcard `*`, restrict to localhost and detected LAN IP.
- [x] Robust physical LAN IP detection: filters out CloudflareWARP VPN (`172.16.0.2`), Docker bridges (`docker0`, `br-*`), and selects physical Wi-Fi `172.20.5.94`.
- [x] Implement FastAPI REST API:
  - [x] `/api/player/status`, `/play`, `/pause`, `/next`, `/previous`, `/seek`, `/volume`, `/shuffle`, `/repeat`
  - [x] `/api/playlist/` (list playlists, active playlist songs, change song, remove, insert, clear, update)
  - [x] `/api/library/` (read-only SQLite query for artist/album/track browsing with `sample_track_url` for covers)
  - [x] `/api/artwork/file` & `/api/artwork/current` (artwork delivery and thumbnailing)
  - [x] `/api/system/info` (network IP, connection status)
- [x] Unit & integration tests for backend (13 tests passing in pytest).

## Phase 4: Frontend Implementation (React + TypeScript + Vite + Tailwind CSS)
- [x] Initialize React + Vite + Tailwind CSS project with Lucide icons.
- [x] Build mobile-first Dark Hi-Fi design system (Roon/TIDAL style).
- [x] Implement Now Playing screen:
  - [x] Album cover art, title, artist, album.
  - [x] Scrubber progress slider with touch pointer events and snap-back protection.
  - [x] Hero play/pause button, prev/next, shuffle, repeat.
  - [x] Volume slider, discrete Volume Up (+5%) and Volume Down (-5%) buttons.
  - [x] Smart mute toggle: restores previous volume level instead of hardcoded 75%.
- [x] Implement Queue / Playlist screen:
  - [x] Displays track title, artist, album, duration.
  - [x] Displays album artwork thumbnails for each track.
  - [x] Accessible touch delete button (no hover requirement on iPhone Safari).
  - [x] Clear Queue button with confirmation modal.
- [x] Implement Library screen:
  - [x] Artists, Albums, Tracks grid/list.
  - [x] Real album artwork thumbnails rendered on album grid cards.
  - [x] "Play All" and "Queue" drill-down buttons using the actual `activePlaylistId`.
- [x] Implement Search screen:
  - [x] Debounced instant search across library.
  - [x] Artwork thumbnails in search album and song results.
  - [x] Add to queue using `activePlaylistId`.
- [x] Implement Settings screen (Clementine connection status, LAN IP info, logout).
- [x] Implement WebSocket client hook with token authentication and auto-reconnection.
- [x] Frontend unit tests with Vitest & React Testing Library (14 tests passing).

## Phase 5: PWA & Mobile Polish
- [x] Web App Manifest (`manifest.webmanifest`), icons, theme color (`#0c0d10`).
- [x] Service Worker (`sw.js`) for PWA offline shell caching and network fallback.
- [x] iOS Safari standalone mode, notch/safe-area handling (`env(safe-area-inset-top)`).
- [x] Responsive layouts for iPhone portrait/landscape, iPad, and desktop.
- [x] Offline fallback state indicating local server status.

## Phase 6: Integration & End-to-End Verification
- [x] Build frontend production bundle and serve statically from FastAPI.
- [x] Verify complete end-to-end control with Clementine running.
- [x] Run Playwright automated browser tests (iPhone 14 Pro emulation).
- [x] Full automated test suite passes (13 backend tests + 14 frontend unit tests).

## Phase 7: Deployment & Delivery
- [x] `install.sh`, `start.sh`, `stop.sh`, `update.sh`.
- [x] Systemd service file template (`systemd/clementine-web-remote.service`).
- [x] `.env.example`, `.gitignore`, `pytest.ini`.
- [x] Comprehensive `README.md` and troubleshooting guide.
- [x] Git commits for all milestones.
