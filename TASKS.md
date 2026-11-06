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
- [x] Implement WebSocket manager for real-time state broadcast.
- [x] Implement FastAPI REST API:
  - [x] `/api/player/status`, `/play`, `/pause`, `/next`, `/previous`, `/seek`, `/volume`, `/shuffle`, `/repeat`
  - [x] `/api/playlist/` (list playlists, active playlist songs, change song, remove, insert)
  - [x] `/api/library/` (read-only SQLite query for instant fast artist/album/track browsing)
  - [x] `/api/artwork/{track_id}` (artwork delivery)
  - [x] `/api/system/info` (network IP, connection status)
- [x] Implement Web Authentication (password protection, session/token).
- [x] Unit & integration tests for backend.

## Phase 4: Frontend Implementation (React + TypeScript + Vite + Tailwind CSS)
- [x] Initialize React + Vite + Tailwind CSS project with Lucide icons.
- [x] Build mobile-first Dark Hi-Fi design system (Roon/TIDAL style).
- [x] Implement Now Playing screen (artwork, progress slider, controls, volume).
- [x] Implement Queue / Playlist screen (track list, active track, jump, reorder/remove).
- [x] Implement Library screen (Artists, Albums, Tracks grid/list).
- [x] Implement Search screen (debounced instant search across library).
- [x] Implement Settings screen (Clementine connection status, LAN IP info, logout).
- [x] Implement WebSocket client hook with auto-reconnection and optimistic UI updates.

## Phase 5: PWA & Mobile Polish
- [x] Web App Manifest (`manifest.webmanifest`), icons, theme color (`#0c0d10`).
- [x] iOS Safari standalone mode, notch/safe-area handling (`env(safe-area-inset-top)`).
- [x] Responsive layouts for iPhone portrait/landscape, iPad, and desktop.
- [x] Offline fallback state indicating local server status.

## Phase 6: Integration & End-to-End Verification
- [x] Build frontend production bundle and serve statically from FastAPI.
- [x] Verify complete end-to-end control with Clementine running.
- [x] Run Playwright automated browser tests (iPhone 14 Pro emulation).
- [x] Verify reconnect behavior when connection drops.

## Phase 7: Deployment & Delivery
- [x] `install.sh`, `start.sh`, `stop.sh`, `update.sh`.
- [x] Systemd service file template (`systemd/clementine-web-remote.service`).
- [x] `.env.example`, `.gitignore`.
- [x] Comprehensive `README.md` and troubleshooting guide.
- [x] Git commits for all milestones.
