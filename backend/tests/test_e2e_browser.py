import os
import sys
import time
import subprocess
import pytest
from playwright.sync_api import sync_playwright

SERVER_PORT = 8089

@pytest.fixture(scope="module")
def live_server():
    env = os.environ.copy()
    env["SERVER_PORT"] = str(SERVER_PORT)
    env["PYTHONPATH"] = "/home/mert/clementine-web-remote"

    proc = subprocess.Popen(
        ["/home/mert/clementine-web-remote/backend/venv/bin/python3", "-m", "uvicorn", "backend.app.main:app", "--port", str(SERVER_PORT)],
        cwd="/home/mert/clementine-web-remote",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Wait for server to boot
    time.sleep(2.5)
    yield f"http://127.0.0.1:{SERVER_PORT}"

    proc.terminate()
    proc.wait()

def test_iphone_safari_experience(live_server):
    with sync_playwright() as p:
        # iPhone 14 Pro viewport & touch simulation
        iphone = p.devices['iPhone 14 Pro']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone)
        page = context.new_page()

        # 1. Open app
        page.goto(live_server)
        page.wait_for_load_state("networkidle")

        # Screenshot login
        os.makedirs("/home/mert/clementine-web-remote/screenshots", exist_ok=True)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/01_login_iphone.png")

        # 2. Enter password
        page.fill('input[type="password"]', 'clementine')
        page.click('button[type="submit"]')
        page.wait_for_timeout(1000)

        # 3. Now Playing Screen
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/02_now_playing_iphone.png")
        assert page.locator('text=Clementine').or_(page.locator('text=Ready to Play')).first.is_visible()

        # Test Volume Controls
        vol_up = page.locator('button[title="Volume Up"]')
        if vol_up.is_visible():
            vol_up.click()
            page.wait_for_timeout(300)

        # 4. Tab Navigation: Queue
        page.click('text=Queue')
        page.wait_for_timeout(800)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/03_queue_iphone.png")
        # Check that queue shows track count or playlist items
        assert page.locator('text=tracks').or_(page.locator('text=track')).first.is_visible()

        # Check Clear Queue confirmation flow if tracks exist
        clear_btn = page.locator('button:has-text("Clear Queue")')
        if clear_btn.is_visible():
            clear_btn.click()
            page.wait_for_timeout(400)
            # Confirm modal is open
            assert page.locator('text=Clear Queue?').is_visible()
            # Click Cancel to preserve user playlist
            page.click('button:has-text("Cancel")')
            page.wait_for_timeout(300)

        # 5. Tab Navigation: Library
        page.click('text=Library')
        page.wait_for_timeout(800)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/04_library_albums_iphone.png")
        assert page.locator('button:has-text("albums")').is_visible()

        # Switch to Artists subtab
        page.click('button:has-text("artists")')
        page.wait_for_timeout(500)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/05_library_artists_iphone.png")
        assert page.locator('button:has-text("artists")').is_visible()

        # 6. Tab Navigation: Search
        page.click('text=Search')
        page.wait_for_timeout(500)
        page.fill('input[placeholder*="Search"]', 'Pink')
        page.wait_for_timeout(800)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/06_search_iphone.png")

        # 7. Tab Navigation: System
        page.click('text=System')
        page.wait_for_timeout(500)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/07_system_iphone.png")
        assert page.locator('text=iPhone Safari Access URL').is_visible()
        # Verify detected LAN IP is displayed
        assert page.locator('text=172.20.5.94').first.is_visible()

        browser.close()
