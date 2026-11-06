# Clementine Web Remote

A premium, modern, responsive Dark Hi-Fi web remote control application for **Clementine Music Player** running on Ubuntu Linux, designed from the ground up for **iPhone Safari** and local network audiophile control.

Works seamlessly on your home Wi-Fi local network without requiring:
- Any iOS App Store app
- Apple Music or cloud services
- External streaming subscriptions
- An internet connection

Clementine remains your native high-fidelity audio playback engine.

---

## Features

- **Dark Hi-Fi Aesthetics**: Inspired by Roon, TIDAL, and modern audiophile interfaces with dark charcoal backgrounds (`#0c0d10`), vibrant amber accents, and glowing playback controls.
- **Real-Time Playback Control**: Play, pause, skip, seek, shuffle modes, repeat modes, and volume slider with instant two-way synchronization over WebSockets.
- **Live Album Artwork**: Direct extraction and caching of Clementine album artwork with smart fallback for library tracks.
- **Queue & Playlist Management**: View current queue, tap any track to jump immediately, remove tracks, and view track lengths.
- **Full Library & Search**: Fast browsing by Artists, Albums, and Tracks with debounced instant search across your entire collection.
- **Progressive Web App (PWA)**: Full iPhone Safari standalone support ("Add to Home Screen") with notch/safe-area optimization and high-resolution icons.
- **Secure by Default**: Password-protected web interface, local LAN binding, zero exposure of Clementine's raw TCP port to the public internet.

---

## System Requirements

- **OS**: Ubuntu Linux (verified on Ubuntu 26.04.1 LTS Resolute)
- **Clementine**: 1.4 RC2 or 1.4+ with Network Remote Control enabled
- **Python**: 3.10+ (tested and verified on Python 3.14.4)
- **Node.js**: v18+ (tested on Node.js v22.23.3)

---

## Clementine Configuration

Ensure Network Remote Control is enabled in Clementine:

1. Open Clementine.
2. Go to **Tools** -> **Preferences** (or press `Ctrl+P`).
3. Select the **Network Remote** tab.
4. Check **Use network remote control**.
5. Set **Port** to `5500`.
6. (Optional) Set an auth code if desired (the remote supports auth codes; default is configured in `.env`).

Alternatively, in `~/.config/Clementine/Clementine.conf`:
```ini
[NetworkRemote]
port=5500
use_remote=true
auth_code=77954
use_auth_code=false
only_non_public_ip=true
```

---

## Quick Installation

Run the automated installer:

```bash
cd /home/mert/clementine-web-remote
./install.sh
```

The installer verifies prerequisites, creates the Python virtual environment (`backend/venv`), compiles official Protobuf protocol definitions, installs npm dependencies, and builds the production React application.

---

## Automatic Lifecycle & Browser Integration (Otomatik Başlatma & Kapatma)

Clementine Web Remote includes an event-driven systemd daemon (`clementine-watcher.service`) that monitors Clementine's lifecycle with 0% idle CPU overhead:
- **When Clementine opens**:
  - The Web Remote server starts automatically in the background.
  - An isolated application window opens directly to `http://127.0.0.1:8000`.
  - A desktop notification (`notify-send`) is shown with the active status and iPhone Safari URL (`http://172.20.5.94:8000`).
- **When Clementine closes**:
  - The dedicated browser window closes automatically.
  - The Web Remote server shuts down cleanly.
  - A desktop notification informs that Clementine Web Remote has stopped.

### Autostart Controls:
```bash
# Enable and start the background watcher
./enable_autostart.sh

# Check watcher, Clementine, server, and browser status
./status_autostart.sh

# Disable and stop the background watcher
./disable_autostart.sh
```

---

## Starting and Stopping (Manual)

### Interactive / CLI:

Start the server:
```bash
./start.sh
```

Stop the server:
```bash
./stop.sh
```

### Systemd Background Service:

To run automatically in the background on startup as a user service:

```bash
mkdir -p ~/.config/systemd/user/
cp systemd/clementine-web-remote.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now clementine-web-remote
```

Check status and logs:
```bash
systemctl --user status clementine-web-remote
journalctl --user -u clementine-web-remote -f
```

---

## Accessing from iPhone Safari

1. Connect your iPhone to the same local Wi-Fi network.
2. Open Safari and navigate to:
   ```
   http://172.20.5.94:8000
   ```
   *(Or your current machine LAN IP shown when running `./start.sh` or in `/api/system/info`)*
3. When prompted, enter the password:
   ```
   clementine
   ```
   *(Configurable in `.env`)*

### Adding to iPhone Home Screen (PWA):

1. While in Safari on your iPhone, tap the **Share** button (the square with an arrow pointing up).
2. Scroll down in the share sheet and tap **Add to Home Screen**.
3. Tap **Add** in the top right corner.
4. Launch Clementine from your iPhone home screen for an app-like, edge-to-edge full-screen Hi-Fi experience!

---

## Configuration (`.env`)

You can customize runtime settings in `.env`:

```ini
# Clementine Remote Host and Port
CLEMENTINE_HOST=172.20.5.94
CLEMENTINE_FALLBACK_HOST=::1
CLEMENTINE_PORT=5500
CLEMENTINE_AUTH_CODE=77954

# Web Remote Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# Authentication & Security
WEB_PASSWORD=clementine
JWT_SECRET=your-secure-random-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=43200

# Paths
MUSIC_DIR=/home/mert/Müzik
CLEMENTINE_DB_PATH=/home/mert/.config/Clementine/clementine.db
```

---

## Updating

To pull changes and rebuild:

```bash
./update.sh
```

---

## Uninstalling

To uninstall Clementine Web Remote cleanly without touching Clementine or your music files:

```bash
# 1. Stop service
./stop.sh
systemctl --user stop clementine-web-remote 2>/dev/null || true
systemctl --user disable clementine-web-remote 2>/dev/null || true
rm -f ~/.config/systemd/user/clementine-web-remote.service

# 2. Remove project directory
rm -rf /home/mert/clementine-web-remote
```

Your Clementine music collection and database remain 100% intact.

---

## Troubleshooting

### 1. Connection Reset / Refused by Clementine
- Verify Clementine is actively running: `pgrep -fl clementine`.
- Check if port 5500 is listening: `ss -tlpn | grep 5500`.
- Clementine 1.4 RC2 restricts connections to local network subnets (`172.16.0.0/12`, `192.168.0.0/16`, `10.0.0.0/8`, or IPv6 `::1`). If loopback `127.0.0.1` is rejected due to Qt's `::ffff:127.0.0.1` dual-stack check, connect using your LAN IP (`172.20.5.94`) or `::1` (both configured automatically by default).

### 2. Can't Access from iPhone
- Make sure iPhone is on the same Wi-Fi network and not on Cellular data.
- Check Ubuntu firewall (`ufw status`). If UFW is active, allow port 8000 locally:
  `sudo ufw allow in on wlo1 to any port 8000 proto tcp`

### 3. Missing Artwork
- Clementine transmits artwork for the active playing track over the remote protocol. For library browsing, the backend automatically extracts embedded tags from audio files or directory `cover.jpg` files and caches them.
