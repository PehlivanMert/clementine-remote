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
- [ ] Implement Clementine TCP protocol client (`backend/app/adapters/clementine/`).
  - Wire framing (4-byte big endian header).
  - Reconnection and keep-alive handling.
  - State tracking (player state, current track, volume, playlist, repeat/shuffle).
  - Album art cache (serving memory/disk cached JPEG).
- [ ] Implement WebSocket manager for real-time state broadcast.
- [ ] Implement FastAPI REST API:
  - `/api/player/status`, `/play`, `/pause`, `/next`, `/previous`, `/seek`, `/volume`, `/shuffle`, `/repeat`
  - `/api/playlist/` (list playlists, active playlist songs, change song, remove, insert)
  - `/api/library/` (read-only SQLite query for instant fast artist/album/track browsing)
  - `/api/artwork/{track_id}` (artwork delivery)
  - `/api/system/info` (network IP, connection status)
- [ ] Implement Web Authentication (password protection, session/token).
- [ ] Unit & integration tests for backend.

## Phase 4: Frontend Implementation (React + TypeScript + Vite + Tailwind CSS)
- [ ] Initialize React + Vite + Tailwind CSS project with Lucide icons.
- [ ] Build mobile-first Dark Hi-Fi design system (Roon/TIDAL style).
- [ ] Implement Now Playing screen (artwork, progress slider, controls, volume).
- [ ] Implement Queue / Playlist screen (track list, active track, jump, reorder/remove).
- [ ] Implement Library screen (Artists, Albums, Tracks grid/list).
- [ ] Implement Search screen (debounced instant search across library).
- [ ] Implement Settings screen (Clementine connection status, LAN IP info, logout).
- [ ] Implement WebSocket client hook with auto-reconnection and optimistic UI updates.

## Phase 5: PWA & Mobile Polish
- [ ] Web App Manifest (`manifest.webmanifest`), icons, theme color (`#0c0d10`).
- [ ] iOS Safari standalone mode, notch/safe-area handling (`env(safe-area-inset-top)`).
- [ ] Responsive layouts for iPhone portrait/landscape, iPad, and desktop.
- [ ] Offline fallback state indicating local server status.

## Phase 6: Integration & End-to-End Verification
- [ ] Build frontend production bundle and serve statically from FastAPI.
- [ ] Verify complete end-to-end control with Clementine running.
- [ ] Run Playwright automated browser tests.
- [ ] Verify reconnect behavior when connection drops.

## Phase 7: Deployment & Delivery
- [ ] `install.sh`, `start.sh`, `stop.sh`, `update.sh`.
- [ ] Systemd service file template.
- [ ] `.env.example`, `.gitignore`.
- [ ] Comprehensive `README.md` and troubleshooting guide.
- [ ] Git commits for all milestones.
