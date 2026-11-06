#!/usr/bin/env python3
"""
Clementine Web Remote — Lifecycle Watcher & Automation Daemon
============================================================
Monitors Clementine music player process lifecycle:
1. When Clementine opens:
   - Starts Clementine Web Remote server (if not already running)
   - Waits for server readiness
   - Opens dedicated web remote browser interface (http://127.0.0.1:8000)
   - Sends desktop notification with iPhone access URL
2. When Clementine closes:
   - Shuts down dedicated web remote browser window
   - Shuts down Clementine Web Remote server
   - Sends desktop notification that Web Remote has stopped
"""

import argparse
import json
import logging
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Optional, Tuple

# Configuration & Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
CONFIG_DIR = Path.home() / ".config" / "clementine-web-remote"
BROWSER_PROFILE_DIR = CONFIG_DIR / "browser-profile"
LOG_DIR = PROJECT_DIR
WATCHER_PID_FILE = CONFIG_DIR / "watcher.pid"
SERVER_PID_FILE = PROJECT_DIR / ".server.pid"
BROWSER_PID_FILE = PROJECT_DIR / ".browser.pid"

DEFAULT_PORT = 8000
SERVER_HOST = "127.0.0.1"

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [ClementineWatcher] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ClementineWatcher")


def ensure_environment() -> None:
    """Ensure graphical desktop and D-Bus environment variables are set."""
    uid = os.getuid()
    if "XDG_RUNTIME_DIR" not in os.environ:
        runtime_dir = f"/run/user/{uid}"
        if os.path.exists(runtime_dir):
            os.environ["XDG_RUNTIME_DIR"] = runtime_dir

    if "DISPLAY" not in os.environ:
        os.environ["DISPLAY"] = ":0"

    if "WAYLAND_DISPLAY" not in os.environ:
        wayland_sock = Path(os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{uid}")) / "wayland-0"
        if wayland_sock.exists():
            os.environ["WAYLAND_DISPLAY"] = "wayland-0"

    if "DBUS_SESSION_BUS_ADDRESS" not in os.environ:
        bus_sock = Path(os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{uid}")) / "bus"
        if bus_sock.exists():
            os.environ["DBUS_SESSION_BUS_ADDRESS"] = f"unix:path={bus_sock}"


def get_configured_port() -> int:
    """Get the Web Remote server port from environment or .env file."""
    if "SERVER_PORT" in os.environ:
        try:
            return int(os.environ["SERVER_PORT"])
        except ValueError:
            pass

    env_path = PROJECT_DIR / ".env"
    if env_path.is_file():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("SERVER_PORT="):
                        val = line.split("=", 1)[1].split("#")[0].strip().strip('"').strip("'")
                        return int(val)
        except Exception:
            pass

    return DEFAULT_PORT


def send_notification(title: str, body: str, urgency: str = "normal") -> bool:
    """Display a desktop notification via notify-send."""
    ensure_environment()
    cmd = [
        "notify-send",
        "-i", "clementine",
        "-a", "Clementine Web Remote",
        "-u", urgency,
        title,
        body,
    ]
    try:
        subprocess.run(cmd, check=True, timeout=3.0, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logger.info("Notification sent: '%s' - '%s'", title, body.replace("\n", " | "))
        return True
    except Exception as e:
        logger.warning("Failed to send notification via notify-send: %s", e)
        return False


def get_clementine_pid() -> Optional[int]:
    """Return the PID of the main Clementine process, or None if not running."""
    # 1. Try pgrep -x clementine
    try:
        out = subprocess.check_output(["pgrep", "-x", "clementine"], text=True, timeout=2.0).strip()
        pids = [int(p) for p in out.splitlines() if p.strip()]
        if pids:
            return pids[0]
    except Exception:
        pass

    # 2. Fallback via /proc scanning
    try:
        for pid_name in os.listdir("/proc"):
            if not pid_name.isdigit():
                continue
            comm_file = Path(f"/proc/{pid_name}/comm")
            try:
                if comm_file.is_file() and comm_file.read_text().strip() == "clementine":
                    return int(pid_name)
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                continue
    except Exception:
        pass

    return None


def is_clementine_running() -> bool:
    """Check if Clementine player is actively running."""
    return get_clementine_pid() is not None


def is_port_open(port: int, host: str = SERVER_HOST) -> bool:
    """Check if TCP port is accepting connections."""
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except Exception:
        return False


def get_system_info(port: int) -> Optional[dict]:
    """Query /api/system/info from the local server."""
    url = f"http://{SERVER_HOST}:{port}/api/system/info"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ClementineWatcher"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        pass
    return None


def detect_fallback_lan_ip() -> str:
    """Detect LAN IP address if backend server is not yet queried."""
    try:
        out = subprocess.check_output(["ip", "-4", "addr", "show", "wlo1"], text=True, timeout=2.0)
        import re
        m = re.search(r"inet\s+(\d+\.\d+\.\d+\.\d+)", out)
        if m:
            return m.group(1)
    except Exception:
        pass
    return "172.20.5.94"


def find_browser() -> Tuple[Optional[str], str]:
    """Find the best available browser for the standalone web remote interface.
    
    Returns (browser_executable_path, browser_type)
    where browser_type is 'chromium', 'firefox', or 'generic'.
    """
    candidates = [
        ("brave-browser", "chromium"),
        ("google-chrome", "chromium"),
        ("google-chrome-stable", "chromium"),
        ("chromium", "chromium"),
        ("chromium-browser", "chromium"),
        ("firefox", "firefox"),
        ("xdg-open", "generic"),
    ]
    for binary, b_type in candidates:
        path = shutil.which(binary)
        if path:
            return path, b_type
    return None, "none"


class ClementineLifecycleManager:
    """Manages the full lifecycle of Clementine Web Remote server, browser, and alerts."""

    def __init__(self, port: Optional[int] = None, enable_browser: bool = True):
        self.port = port or get_configured_port()
        self.enable_browser = enable_browser
        self.server_proc: Optional[subprocess.Popen] = None
        self.browser_proc: Optional[subprocess.Popen] = None
        self.is_active = False

        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        BROWSER_PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    def start_server(self) -> bool:
        """Start the backend uvicorn server in a separate process group if not already running."""
        if is_port_open(self.port) and get_system_info(self.port) is not None:
            logger.info("Server is already running and healthy on port %d.", self.port)
            return True

        venv_python = PROJECT_DIR / "backend" / "venv" / "bin" / "python3"
        python_bin = venv_python if venv_python.is_file() else Path(sys.executable)

        cmd = [
            str(python_bin),
            "-m", "uvicorn",
            "backend.app.main:app",
            "--host", "0.0.0.0",
            "--port", str(self.port),
        ]

        env = os.environ.copy()
        env["PYTHONPATH"] = str(PROJECT_DIR)
        ensure_environment()

        server_log = PROJECT_DIR / "server.log"
        log_file = open(server_log, "a", encoding="utf-8")

        logger.info("Starting Web Remote server: %s", " ".join(cmd))
        try:
            self.server_proc = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_DIR),
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                start_new_session=True,  # Isolate in its own process group
            )
            SERVER_PID_FILE.write_text(str(self.server_proc.pid))
            logger.info("Server process started with PID %d.", self.server_proc.pid)
        except Exception as e:
            logger.error("Failed to start server: %s", e)
            return False

        # Wait for server to become responsive
        max_attempts = 50  # 5 seconds
        for _ in range(max_attempts):
            time.sleep(0.1)
            info = get_system_info(self.port)
            if info:
                logger.info("Server is ready and verified on port %d.", self.port)
                return True

        logger.warning("Server started but did not respond within 5 seconds.")
        return is_port_open(self.port)

    def stop_server(self) -> None:
        """Stop the Web Remote backend server process."""
        logger.info("Stopping Web Remote server...")

        # 1. Terminate tracked server process
        if self.server_proc and self.server_proc.poll() is None:
            try:
                pgid = os.getpgid(self.server_proc.pid)
                os.killpg(pgid, signal.SIGTERM)
                self.server_proc.wait(timeout=3.0)
            except Exception:
                try:
                    os.killpg(os.getpgid(self.server_proc.pid), signal.SIGKILL)
                except Exception:
                    pass
            self.server_proc = None

        # 2. Check PID file if tracked process was external
        if SERVER_PID_FILE.is_file():
            try:
                pid = int(SERVER_PID_FILE.read_text().strip())
                if pid > 0 and pid != os.getpid():
                    os.kill(pid, signal.SIGTERM)
                    time.sleep(0.5)
            except Exception:
                pass
            try:
                SERVER_PID_FILE.unlink(missing_ok=True)
            except Exception:
                pass

        # 3. Terminate any lingering uvicorn backend.app.main:app
        try:
            subprocess.run(["pkill", "-f", "uvicorn backend.app.main:app"], timeout=2.0, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

        # Wait for port to clear
        for _ in range(20):
            if not is_port_open(self.port):
                break
            time.sleep(0.1)

        logger.info("Web Remote server stopped.")

    def open_browser(self) -> bool:
        """Open the web remote interface in an isolated application window."""
        if not self.enable_browser:
            logger.info("Browser opening disabled by configuration.")
            return False

        # Check if an existing browser window launched by us is still alive
        if self.browser_proc and self.browser_proc.poll() is None:
            logger.info("Dedicated browser window (PID %d) is already open.", self.browser_proc.pid)
            return True

        browser_bin, b_type = find_browser()
        if not browser_bin:
            logger.warning("No supported browser found on system.")
            return False

        target_url = f"http://127.0.0.1:{self.port}"
        ensure_environment()

        if b_type == "chromium":
            # App mode in dedicated user-data-dir gives a clean, frameless, native-app feel
            # and isolates its process tree so we can terminate it without closing user tabs
            cmd = [
                browser_bin,
                f"--app={target_url}",
                f"--user-data-dir={BROWSER_PROFILE_DIR}",
                "--class=clementine-web-remote",
                "--app-id=clementine-web-remote",
                "--no-first-run",
                "--no-default-browser-check",
            ]
        elif b_type == "firefox":
            cmd = [browser_bin, "--new-window", target_url]
        else:
            cmd = [browser_bin, target_url]

        logger.info("Opening browser: %s", " ".join(cmd))
        try:
            self.browser_proc = subprocess.Popen(
                cmd,
                start_new_session=True,  # Own process group for clean teardown
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            BROWSER_PID_FILE.write_text(str(self.browser_proc.pid))
            logger.info("Browser launched with PID %d.", self.browser_proc.pid)
            return True
        except Exception as e:
            logger.error("Failed to launch browser: %s", e)
            return False

    def close_browser(self) -> None:
        """Close the dedicated browser window and terminate its process group."""
        logger.info("Closing Web Remote browser...")

        # 1. Terminate tracked browser process group
        if self.browser_proc and self.browser_proc.poll() is None:
            try:
                pgid = os.getpgid(self.browser_proc.pid)
                os.killpg(pgid, signal.SIGTERM)
                self.browser_proc.wait(timeout=2.0)
            except Exception:
                try:
                    os.killpg(os.getpgid(self.browser_proc.pid), signal.SIGKILL)
                except Exception:
                    pass
            self.browser_proc = None

        # 2. Check PID file
        if BROWSER_PID_FILE.is_file():
            try:
                pid = int(BROWSER_PID_FILE.read_text().strip())
                if pid > 0 and pid != os.getpid():
                    os.kill(pid, signal.SIGTERM)
            except Exception:
                pass
            try:
                BROWSER_PID_FILE.unlink(missing_ok=True)
            except Exception:
                pass

        # 3. Clean up any remaining processes locked to our specific user-data-dir
        try:
            profile_flag = f"--user-data-dir={BROWSER_PROFILE_DIR}"
            subprocess.run(["pkill", "-f", profile_flag], timeout=2.0, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

        logger.info("Web Remote browser closed.")

    def on_clementine_opened(self) -> None:
        """Handle Clementine opening event."""
        if self.is_active:
            return

        logger.info(">>> Event: Clementine opened! Activating Web Remote...")
        self.is_active = True

        # 1. Start Server
        self.start_server()

        # 2. Retrieve iPhone URL from system info
        info = get_system_info(self.port)
        if info and "iphone_url" in info:
            iphone_url = info["iphone_url"]
        else:
            lan_ip = detect_fallback_lan_ip()
            iphone_url = f"http://{lan_ip}:{self.port}"

        # 3. Open Browser
        self.open_browser()

        # 4. Notify Desktop
        notification_title = "Clementine Web Remote"
        notification_body = f"Clementine açıldı, Web Remote aktif!\niPhone URL: {iphone_url}"
        send_notification(notification_title, notification_body)

    def on_clementine_closed(self) -> None:
        """Handle Clementine closing event."""
        if not self.is_active:
            return

        logger.info(">>> Event: Clementine closed! Deactivating Web Remote...")
        self.is_active = False

        # 1. Close Browser
        self.close_browser()

        # 2. Stop Server
        self.stop_server()

        # 3. Notify Desktop
        notification_title = "Clementine Web Remote"
        notification_body = "Clementine kapandı, Web Remote durduruldu."
        send_notification(notification_title, notification_body)

    def sync(self) -> None:
        """Synchronize active state with Clementine process state."""
        running = is_clementine_running()
        if running and not self.is_active:
            self.on_clementine_opened()
        elif not running and self.is_active:
            self.on_clementine_closed()

    def get_status(self) -> dict:
        """Get the full status dictionary for inspection."""
        clem_pid = get_clementine_pid()
        srv_running = is_port_open(self.port)
        info = get_system_info(self.port) if srv_running else None
        browser_running = (self.browser_proc and self.browser_proc.poll() is None)

        return {
            "clementine_running": clem_pid is not None,
            "clementine_pid": clem_pid,
            "server_running": srv_running,
            "server_port": self.port,
            "server_info": info,
            "browser_running": browser_running,
            "browser_profile": str(BROWSER_PROFILE_DIR),
            "watcher_active_state": self.is_active,
        }


def run_daemon(manager: ClementineLifecycleManager) -> None:
    """Run the continuous watcher daemon with D-Bus signals and proc fallback."""
    WATCHER_PID_FILE.write_text(str(os.getpid()))
    logger.info("Starting Clementine Lifecycle Watcher Daemon (PID %d)...", os.getpid())

    # Initial state sync
    manager.sync()

    # Try D-Bus event listening via Gio
    has_gio = False
    try:
        import gi
        from gi.repository import Gio, GLib  # type: ignore

        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)

        def on_name_owner_changed(conn, sender, path, iface, signal_name, params, user_data):
            name, old_owner, new_owner = params.unpack()
            if name == "org.mpris.MediaPlayer2.clementine":
                if new_owner and not old_owner:
                    logger.info("D-Bus event: Clementine registered on session bus.")
                    manager.on_clementine_opened()
                elif old_owner and not new_owner:
                    logger.info("D-Bus event: Clementine released session bus.")
                    manager.on_clementine_closed()

        bus.signal_subscribe(
            "org.freedesktop.DBus",
            "org.freedesktop.DBus",
            "NameOwnerChanged",
            "/org/freedesktop/DBus",
            None,
            Gio.DBusSignalFlags.NONE,
            on_name_owner_changed,
            None,
        )

        loop = GLib.MainLoop()

        def periodic_sync_cb():
            manager.sync()
            return True  # Keep repeating

        # Periodic fallback check every 2 seconds
        GLib.timeout_add_seconds(2, periodic_sync_cb)

        # Handle termination signals
        def on_sig_terminate(*_):
            logger.info("Termination signal received. Exiting GLib loop...")
            loop.quit()
            return False

        try:
            from gi.repository import GLibUnix  # type: ignore
            GLibUnix.signal_add(GLib.PRIORITY_HIGH, signal.SIGTERM, on_sig_terminate, None)
            GLibUnix.signal_add(GLib.PRIORITY_HIGH, signal.SIGINT, on_sig_terminate, None)
        except Exception:
            signal.signal(signal.SIGTERM, lambda *_: loop.quit())
            signal.signal(signal.SIGINT, lambda *_: loop.quit())

        has_gio = True
        logger.info("Event-driven D-Bus listener active with 2s proc safety-net timer.")
        loop.run()
    except Exception as e:
        logger.info("D-Bus Gio integration not used (%s). Running standard proc loop.", e)

    if not has_gio:
        # Fallback pure-Python loop
        stop_daemon = False

        def handle_sig(*_):
            nonlocal stop_daemon
            logger.info("Termination signal received. Stopping watcher loop...")
            stop_daemon = True

        signal.signal(signal.SIGTERM, handle_sig)
        signal.signal(signal.SIGINT, handle_sig)

        while not stop_daemon:
            try:
                manager.sync()
            except Exception as ex:
                logger.error("Error during sync: %s", ex)
            time.sleep(1.0)

    # Clean shutdown
    WATCHER_PID_FILE.unlink(missing_ok=True)
    logger.info("Watcher daemon exited cleanly.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Clementine Web Remote Lifecycle Automation Daemon")
    parser.add_argument("--daemon", action="store_true", help="Run in continuous daemon mode (default)")
    parser.add_argument("--start", action="store_true", help="Trigger startup lifecycle manually")
    parser.add_argument("--stop", action="store_true", help="Trigger shutdown lifecycle manually")
    parser.add_argument("--status", action="store_true", help="Print current status and exit")
    parser.add_argument("--oneshot", action="store_true", help="Synchronize current state once and exit")
    parser.add_argument("--no-browser", action="store_true", help="Do not open or close browser window")
    parser.add_argument("--port", type=int, default=None, help="Custom server port (default: 8000)")
    args = parser.parse_args()

    manager = ClementineLifecycleManager(port=args.port, enable_browser=not args.no_browser)

    if args.status:
        st = manager.get_status()
        print(json.dumps(st, indent=2))
        sys.exit(0)

    if args.start:
        manager.on_clementine_opened()
        sys.exit(0)

    if args.stop:
        manager.on_clementine_closed()
        sys.exit(0)

    if args.oneshot:
        manager.sync()
        sys.exit(0)

    # Default action is daemon
    run_daemon(manager)


if __name__ == "__main__":
    main()
