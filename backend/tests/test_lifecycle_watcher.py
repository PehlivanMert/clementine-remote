import json
import os
import shutil
import socket
import subprocess
import time
from pathlib import Path
import pytest

from scripts.clementine_watcher import (
    ClementineLifecycleManager,
    find_browser,
    get_clementine_pid,
    is_clementine_running,
    is_port_open,
    send_notification,
    get_system_info,
    get_configured_bool,
    detect_fallback_lan_ip,
    clean_browser_profile_state,
    BROWSER_PID_FILE,
    SERVER_PID_FILE,
)


def test_get_clementine_pid_and_status():
    """Verify Clementine process detection."""
    pid = get_clementine_pid()
    running = is_clementine_running()
    if pid is not None:
        assert isinstance(pid, int)
        assert pid > 0
        assert running is True
    else:
        assert running is False


def test_is_port_open():
    """Verify TCP port probe logic using a real ephemeral socket."""
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]

    try:
        assert is_port_open(port) is True
    finally:
        srv.close()

    time.sleep(0.1)
    assert is_port_open(port) is False


def test_find_browser():
    """Verify browser discovery locates a browser on the system."""
    browser_bin, b_type = find_browser()
    assert browser_bin is not None
    assert Path(browser_bin).is_file()
    assert b_type in ("chromium", "firefox", "generic")


def test_send_notification():
    """Verify desktop notification dispatch via notify-send."""
    res = send_notification("Clementine Test Notification", "Automated unit test notification body")
    assert res is True


def test_lifecycle_manager_status():
    """Verify get_status returns a well-formed dictionary with real daemon/browser metrics."""
    manager = ClementineLifecycleManager(port=8000)
    status = manager.get_status()

    assert "clementine_running" in status
    assert "clementine_pid" in status
    assert "server_running" in status
    assert "server_pid" in status
    assert "server_port" in status
    assert "browser_running" in status
    assert "browser_pid" in status
    assert "browser_profile" in status
    assert "watcher_daemon_running" in status
    assert "watcher_daemon_pid" in status
    assert "watcher_active_state" in status
    assert status["server_port"] == 8000


def test_service_unit_file_validity():
    """Verify systemd unit file exists and has required sections and paths."""
    unit_path = Path("/home/mert/clementine-web-remote/systemd/clementine-watcher.service")
    assert unit_path.is_file()
    content = unit_path.read_text()

    assert "[Unit]" in content
    assert "[Service]" in content
    assert "[Install]" in content
    assert "ExecStart=/usr/bin/python3" in content
    assert "clementine_watcher.py" in content
    assert "Restart=always" in content


def test_lifecycle_server_and_browser_start_stop():
    """Integration test: start server, verify responsiveness, open browser, close browser, stop server."""
    manager = ClementineLifecycleManager(port=8000, enable_browser=True)

    # Clean initial state
    manager.stop_server()
    manager.close_browser()
    assert is_port_open(8000) is False

    try:
        # 1. Trigger open lifecycle
        manager.on_clementine_opened()
        assert manager.is_active is True
        assert is_port_open(8000) is True

        # Verify server endpoint responds
        info = get_system_info(8000)
        assert info is not None
        assert "server_name" in info
        assert "lan_ip" in info

        # Verify browser process was started
        if manager.browser_proc:
            assert manager.browser_proc.poll() is None

        # 2. Trigger close lifecycle
        manager.on_clementine_closed()
        assert manager.is_active is False

        # Verify server is stopped and port is freed
        time.sleep(1.0)
        assert is_port_open(8000) is False
        if manager.browser_proc:
            assert manager.browser_proc.poll() is not None
    finally:
        manager.stop_server()
        manager.close_browser()


def test_on_clementine_closed_force_when_not_active(tmp_path):
    """Verify on_clementine_closed(force=True) terminates components even if is_active is False."""
    manager = ClementineLifecycleManager(port=8000)
    assert manager.is_active is False

    # Simulate a fake tracked PID file
    dummy_pid = 99999999
    BROWSER_PID_FILE.write_text(str(dummy_pid))
    try:
        manager.on_clementine_closed(force=True)
        assert not BROWSER_PID_FILE.is_file()
    finally:
        BROWSER_PID_FILE.unlink(missing_ok=True)


def test_get_configured_bool_settings(monkeypatch):
    """Verify boolean config parsing for AUTO_OPEN_BROWSER and BROWSER_APP_MODE."""
    monkeypatch.setenv("TEST_FLAG_TRUE", "true")
    monkeypatch.setenv("TEST_FLAG_FALSE", "false")
    monkeypatch.setenv("TEST_FLAG_ONE", "1")
    monkeypatch.setenv("TEST_FLAG_ZERO", "0")

    assert get_configured_bool("TEST_FLAG_TRUE", False) is True
    assert get_configured_bool("TEST_FLAG_FALSE", True) is False
    assert get_configured_bool("TEST_FLAG_ONE", False) is True
    assert get_configured_bool("TEST_FLAG_ZERO", True) is False
    assert get_configured_bool("NON_EXISTENT_VAR", True) is True
    assert get_configured_bool("NON_EXISTENT_VAR", False) is False


def test_detect_fallback_lan_ip_validity():
    """Verify fallback LAN IP detection returns a valid IPv4 string."""
    ip = detect_fallback_lan_ip()
    assert isinstance(ip, str)
    parts = ip.split(".")
    assert len(parts) == 4
    for p in parts:
        assert p.isdigit()
        assert 0 <= int(p) <= 255


def test_clean_browser_profile_state(tmp_path):
    """Verify Chromium profile preferences are sanitized to avoid crash recovery bubbles."""
    profile_dir = tmp_path / "browser-profile"
    default_dir = profile_dir / "Default"
    default_dir.mkdir(parents=True)
    pref_file = default_dir / "Preferences"
    pref_file.write_text(json.dumps({
        "profile": {
            "exit_type": "Crashed",
            "exited_cleanly": False,
        }
    }))

    clean_browser_profile_state(profile_dir)

    data = json.loads(pref_file.read_text())
    assert data["profile"]["exit_type"] == "Normal"
    assert data["profile"]["exited_cleanly"] is True


def test_pygobject_dbus_available():
    """Verify gi / Gio can be imported successfully in the current Python environment."""
    import sys
    if "/usr/lib/python3/dist-packages" not in sys.path and Path("/usr/lib/python3/dist-packages/gi").is_dir():
        sys.path.append("/usr/lib/python3/dist-packages")
    import gi
    from gi.repository import Gio
    assert Gio is not None
