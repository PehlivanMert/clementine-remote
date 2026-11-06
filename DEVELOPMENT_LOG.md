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
