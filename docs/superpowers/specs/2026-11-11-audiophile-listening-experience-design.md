# Clementine Web Remote — Audiophile Listening Experience & Automation Design Document

**Date:** 2026-11-11  
**Project:** Clementine Web Remote (`/home/mert/clementine-web-remote`)  
**Status:** Approved Architecture (Ready for Implementation Planning)  
**Author:** Antigravity & Mert Pehlivan  

---

## 1. Intent and The Why

Mert uses Clementine on an Ubuntu desktop connected to a high-end portable speaker (**Harman Kardon Go + Play 3**) via 3.5mm AUX analog cable with bit-perfect PipeWire configuration (44.1 kHz, 96 kHz, 192 kHz) and **Apple AirPods Pro 2**. The Clementine Web Remote is predominantly accessed via an **iPhone Safari PWA** and desktop browser.

While the existing Web Remote reliably handles playback, playlist/queue management, and library searching, listening sessions—especially night listening from a bed or couch—lack deep sensory feedback, immersion, and lock-screen convenience. 

This enhancement transforms the Web Remote into an immersive **Audiophile Listening Companion & Automation Controller**:
1. Showing **synchronized karaoke / plain lyrics** on demand with seek-on-click.
2. Displaying genuine **Audiophile Badges** (FLAC 24-bit / 96 kHz Hi-Res, 16-bit / 44.1 kHz CD Quality, 320 kbps MP3) extracted directly from local audio files.
3. Illuminating the interface with a dynamic **Ambient Glow** matching the current album art.
4. Enabling a rock-solid **Backend-Authoritative Sleep Timer** with smooth volume fade-out for night sessions.
5. Providing **iOS Lock Screen Media Controls** via HTML5 Media Session API with user-gesture arming.
6. Offering **One-Touch Quick Volume Presets** (including the Harman Kardon AUX 85-90% bit-perfect sweet spot).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
* **Live Lyrics (Karaoke / Synced & Plain)**: Fast, non-blocking lyrics fetching. Queries `LRCLIB` (an open-source, free, public API without API keys) first for synced timestamps; falls back to local file tags and Clementine protobuf if LRCLIB has no match.
* **Accurate Audiophile Badges**: Reads genuine audio specs directly from local storage (`/home/mert/Müzik/`) using backend file probing (`mutagen` / `ffprobe`) so 24-bit studio FLACs, 16-bit CD rips, and MP3 bitrates are accurately branded with distinctive gold/cyan visual badges.
* **Ambient Glow**: Computes artwork backdrop dynamically in real time without lag, responsive to dark theme.
* **Backend Sleep Timer with Soft Fade**: Runs on the server host so iOS device sleep/backgrounding cannot interrupt the countdown or the fade-out.
* **iOS Lock Screen & Background Playback Control**: Uses HTML5 `navigator.mediaSession` with a silent audio element keep-alive loop armed on user touch.
* **Quick Audio Presets**: Quick volume shortcuts (e.g. 88% HK AUX Bit-Perfect, 50% Casual, 25% Night).

### Non-Goals
* Cloud music streaming (Spotify/Tidal direct stream playback inside the browser) — Clementine remains the local player.
* Destructive file tag editing from the Web Remote.
* Replacing PipeWire system configuration or Clementine desktop GUI.

### Anti-Goals
* No heavy external dependencies that require paid API subscriptions, API keys, or Docker containers.
* No audio latency or stuttering introduced into Clementine's playback pipeline.
* No battery drain on mobile due to unthrottled canvas animations or canvas loops.

---

## 3. Constraints

* **Platform**: Clementine 1.4 rc2 running on Ubuntu 24.04 (Wayland/X11), Python 3.14 FastAPI backend, Vite + React + TailwindCSS frontend.
* **Client**: iOS Safari (PWA standalone mode) and desktop Chrome/Brave.
* **Protocol**: TCP Protobuf socket (port 5500) connecting FastAPI to Clementine.
* **Firewall / Network**: Bound to `0.0.0.0:8000`, local LAN IP `172.20.5.94`.

---

## 4. Approaches Considered

### Approach 1: Hybrid Intelligent Integration (Selected)
* **Architecture**: Combines Clementine's native protobuf messages with server-side local file analysis and a lightweight open-source API fallback (`LRCLIB`).
* **Tradeoffs**: Slightly more backend logic, but delivers 100% accurate audio badges and virtually 100% lyrics hit-rate with synced karaoke.
* **Decision**: Selected by user for maximum fidelity and completeness.

### Approach 2: Pure Clementine Native (Minimalist)
* **Architecture**: Relies strictly on what Clementine's protobuf protocol returns natively (`GET_LYRICS` and `SongMetadata.Type`).
* **Tradeoffs**: Clementine's built-in lyrics fetchers are often outdated/blocked, and its protobuf protocol does not report bit depth (16-bit vs 24-bit). Rejected.

### Approach 3: Two-Phase Staged Delivery
* **Architecture**: Splits work into two separate sprints.
* **Tradeoffs**: Rejected in favor of a cohesive, immediate release.

---

## 5. Detailed Component Architecture & Builder Review Decisions

### A. Sleep Timer Architecture (Backend-Authoritative)
* **Review Call (Builder Decision)**: The timer state machine, countdown, and volume fade-out **MUST execute on the FastAPI backend** (`asyncio` background task in `backend/app/services/sleep_timer_service.py`), NOT on the frontend.
  - *Reasoning*: iOS Safari pauses background JavaScript execution as soon as the screen turns off. A frontend timer would freeze mid-countdown, leaving music playing indefinitely.
* **Endpoints**:
  - `POST /api/player/sleep-timer` (`{"duration_minutes": 15|30|45|60, "end_of_track": false}`)
  - `DELETE /api/player/sleep-timer` (Cancels active timer immediately, restoring initial volume if currently fading)
  - `GET /api/player/sleep-timer` (`{"active": bool, "remaining_seconds": int, "initial_volume": int}`)
* **WebSocket Synchronization**:
  - Backend emits `sleep_timer_updated` event with remaining seconds every 5 seconds (and every 1 second during the final 60-second fade), keeping phone and desktop UI in lock-step.
* **Fade-Out Logic**:
  - When `remaining_seconds <= 60`, backend linearly steps down volume every 2 seconds until 0%, then issues Clementine `PAUSE`.
  - Upon completion or cancellation during fade, original volume is restored in Clementine so future sessions don't start muted.

### B. Lyrics Resolution Hierarchy & Engine
* **Review Call (Builder Decision)**: `LRCLIB` is queried as the **Primary Provider** for lyrics, with Clementine Protobuf and local file tags as secondary fallbacks.
  - *Reasoning*: Clementine's `Lyric.content` only supports unsynchronized plain text. If Clementine were queried first, synced karaoke lyrics would be starved. Furthermore, Clementine's TCP socket has no negative ACK, causing socket timeout delays when Clementine lacks lyrics.
* **Flow**:
  1. Backend checks in-memory LRU cache (`artist + title`).
  2. Queries `https://lrclib.net/api/get?artist_name=...&track_name=...&album_name=...&duration=...`.
  3. If found and has `syncedLyrics`: parses LRC timestamps `[mm:ss.xx]` into structured `[{time: float, text: str}]`.
  4. If LRCLIB returns 404 or plain only: checks local audio file ID3/FLAC lyrics tags (`USLT`, `LYRICS`), and queries Clementine protobuf `GET_LYRICS`.
  5. Returns `{ synced: bool, lines: list, plain: str }`.
* **Frontend Lyrics Modal**:
  - Interactive karaoke sheet with autoscroll tied to current playback position (`track_position_ms`).
  - Clicking any lyric line instantly seeks Clementine to that exact timestamp!

### C. Audiophile Badges Architecture
* **Metadata Extractor (`backend/app/services/audio_meta_service.py`)**:
  - Runs on backend when song changes. Reads local file header using `mutagen` or `ffprobe`.
  - Caches audio format properties:
    * `audio_format`: "FLAC", "MP3", "AAC", "ALAC", "WAV"
    * `bit_depth`: `16` or `24` (or `32`)
    * `sample_rate`: `44100`, `48000`, `88200`, `96000`, `192000`
    * `bit_rate`: `320000` (for lossy MP3)
    * `is_hi_res`: `true` if `bit_depth >= 24` or `sample_rate >= 88200`
  - Broadcast over WebSocket inside `player_state` payload.
* **Frontend Visuals**:
  - Glowing badges in `NowPlaying.tsx`:
    * `HI-RES LOSSLESS • 24-BIT / 96 kHz` (Gold badge with subtle shimmer)
    * `LOSSLESS • 16-BIT / 44.1 kHz` (Cyan / Silver badge)
    * `MP3 • 320 KBPS` (Slate badge)

### D. Ambient Glow Atmosphere
* **Dynamic Backdrop**:
  - Smooth layered CSS radial gradients placed behind album art in `NowPlaying.tsx`:
    ```css
    background: radial-gradient(circle at 50% 35%, var(--accent-glow, rgba(234, 179, 8, 0.22)) 0%, transparent 65%);
    filter: blur(64px);
    ```
  - When artwork changes, client extracts dominant color from a 16x16 offscreen canvas sample of the album art and updates `--accent-glow` smoothly via CSS transition.

### E. iOS Media Session & Lock Screen Controls
* **Review Call (Builder Decision)**: Armed upon user touch interaction with fallback silent audio keep-alive.
  - *Arming*: On first user tap anywhere on the UI, a hidden inaudible looping `<audio>` element (`data:audio/wav;base64,...`) is primed.
  - *Handlers*: `navigator.mediaSession.setActionHandler` for `play`, `pause`, `nexttrack`, `previoustrack`, `seekto`.
  - *Sync*: `navigator.mediaSession.playbackState` stays synchronized with Clementine state ('playing' vs 'paused').
  - *UI Toggle*: Option in System view ("Lock Screen Controls" toggle).

### F. One-Touch Volume Presets
* Direct volume pills on player bar:
  - **88% (HK AUX)**: Optimal bit-perfect line output without clipping for Harman Kardon Go + Play 3.
  - **50% (Normal)**: Casual day listening.
  - **20% (Night)**: Low ambient level.

---

## 6. What's Left to the Builder

* Minor UI layout alignment and smooth transitions.
* Vitest and pytest test coverage for timer, lyrics, and metadata parsing.
* Performance verification under mobile Safari PWA standalone mode.
