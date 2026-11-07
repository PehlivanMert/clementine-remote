import os
import sys
import time
import subprocess
import pytest
from playwright.sync_api import sync_playwright
from backend.app.config import settings

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
        # iPhone 14 Pro portrait viewport (393x852) & touch simulation
        iphone_base = p.devices['iPhone 14 Pro']
        portrait_config = {
            **iphone_base,
            'viewport': {'width': 393, 'height': 852},
            'screen': {'width': 393, 'height': 852},
        }
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**portrait_config)
        page = context.new_page()

        # 1. Open app
        page.goto(live_server)
        page.wait_for_load_state("networkidle")

        # Screenshot login
        os.makedirs("/home/mert/clementine-web-remote/screenshots", exist_ok=True)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/01_login_iphone.png")

        # 2. Enter password if prompted
        pwd_input = page.locator('input[type="password"]')
        try:
            pwd_input.wait_for(state="visible", timeout=2500)
            page.fill('input[type="password"]', settings.WEB_PASSWORD)
            page.click('button[type="submit"]')
            pwd_input.wait_for(state="hidden", timeout=3000)
            page.wait_for_timeout(500)
        except Exception:
            pass

        # 3. Now Playing Screen (Portrait)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/02_now_playing_iphone.png")
        assert page.locator('text=Clementine').or_(page.locator('text=Ready to Play')).first.is_visible()

        # Test Volume Controls in Portrait without collision
        vol_up = page.locator('button[title="Volume Up"]')
        nav = page.locator('nav')
        if vol_up.is_visible() and nav.is_visible():
            vol_box = vol_up.bounding_box()
            nav_box = nav.bounding_box()
            assert nav_box['y'] - (vol_box['y'] + vol_box['height']) >= 20
            vol_up.click()
            page.wait_for_timeout(300)

        # 4. Tab Navigation: Queue
        page.click('text=Queue')
        page.wait_for_timeout(800)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/03_queue_iphone.png")
        assert page.locator('text=tracks').or_(page.locator('text=track')).first.is_visible()

        # Check Clear Queue confirmation flow if tracks exist
        clear_btn = page.locator('button:has-text("Clear Queue")')
        if clear_btn.is_visible():
            clear_btn.click()
            page.wait_for_timeout(400)
            assert page.locator('text=Clear Queue?').is_visible()
            page.click('button:has-text("Cancel")')
            page.wait_for_timeout(300)

        # 5. Tab Navigation: Library
        page.click('nav >> text=Library')
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
        assert page.locator(f'text={settings.LAN_IP}').first.is_visible()

        browser.close()

def test_iphone_landscape_experience(live_server):
    with sync_playwright() as p:
        # iPhone 14 Pro landscape viewport & touch simulation
        iphone_base = p.devices['iPhone 14 Pro']
        landscape_config = {
            **iphone_base,
            'viewport': {'width': 852, 'height': 393},
            'screen': {'width': 852, 'height': 393},
        }
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**landscape_config)
        page = context.new_page()

        # 1. Open app
        page.goto(live_server)
        page.wait_for_load_state("networkidle")

        # 2. Enter password if prompted
        pwd_input = page.locator('input[type="password"]')
        try:
            pwd_input.wait_for(state="visible", timeout=2500)
            page.fill('input[type="password"]', settings.WEB_PASSWORD)
            page.click('button[type="submit"]')
            pwd_input.wait_for(state="hidden", timeout=3000)
            page.wait_for_timeout(500)
        except Exception:
            pass

        # 3. Now Playing Screen (Landscape 2-column view)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/02_now_playing_iphone_landscape.png")
        assert page.locator('text=Clementine').or_(page.locator('text=Ready to Play')).first.is_visible()

        # Test Volume Controls in Landscape without collision
        vol_up = page.locator('button[title="Volume Up"]')
        nav = page.locator('nav')
        if vol_up.is_visible() and nav.is_visible():
            vol_box = vol_up.bounding_box()
            nav_box = nav.bounding_box()
            assert nav_box['y'] - (vol_box['y'] + vol_box['height']) >= 15
            vol_up.click()
            page.wait_for_timeout(300)

        vol_down = page.locator('button[title="Volume Down"]')
        if vol_down.is_visible():
            vol_down.click()
            page.wait_for_timeout(300)

        # Confirm queue badge does not overlap tab text in landscape
        badge = page.locator('nav span:has-text("1165")').first
        queue_label = page.locator('nav span:has-text("Queue")').first
        if badge.is_visible() and queue_label.is_visible():
            b_box = badge.bounding_box()
            q_box = queue_label.bounding_box()
            assert b_box['x'] >= q_box['x'] + q_box['width'] - 1

        # 4. Queue tab in landscape
        page.click('text=Queue')
        page.wait_for_timeout(800)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/03_queue_iphone_landscape.png")
        assert page.locator('text=tracks').or_(page.locator('text=track')).first.is_visible()

        # 5. Library tab in landscape
        page.click('nav >> text=Library')
        page.wait_for_timeout(800)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/04_library_albums_iphone_landscape.png")
        assert page.locator('button:has-text("albums")').is_visible()

        # 6. Search tab in landscape
        page.click('text=Search')
        page.wait_for_timeout(500)
        page.fill('input[placeholder*="Search"]', 'Pink')
        page.wait_for_timeout(800)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/06_search_iphone_landscape.png")

        # 7. System tab in landscape
        page.click('text=System')
        page.wait_for_timeout(500)
        page.screenshot(path="/home/mert/clementine-web-remote/screenshots/07_system_iphone_landscape.png")
        assert page.locator('text=iPhone Safari Access URL').is_visible()

        browser.close()
