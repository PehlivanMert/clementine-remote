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
    """Verify get_status returns a well-formed dictionary."""
    manager = ClementineLifecycleManager(port=8000)
    status = manager.get_status()

    assert "clementine_running" in status
    assert "clementine_pid" in status
    assert "server_running" in status
    assert "server_port" in status
    assert "browser_profile" in status
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
