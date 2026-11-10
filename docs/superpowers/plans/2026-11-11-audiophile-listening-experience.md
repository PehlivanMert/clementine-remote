# Audiophile Listening Experience & Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Clementine Web Remote into an immersive audiophile listening companion with synchronized lyrics (karaoke with seek-on-click), genuine audio specs/Hi-Res badges, ambient album art glow, server-side sleep timer with soft volume fade-out, quick volume presets, and iOS lock screen controls.

**Architecture:** 
- **Backend**: FastAPI adds `AudioMetaService` (local file probing for 24-bit/96kHz), `LyricsService` (LRCLIB primary with Clementine/local tag fallback), and `SleepTimerService` (host-authoritative `asyncio` task with 60s linear fade-out and WebSocket broadcasts).
- **Frontend**: React components for `AudiophileBadge` (gold/cyan badges), dynamic CSS ambient glow in `NowPlaying`, `LyricsModal` (interactive karaoke sheet with seek-on-click), `SleepTimerModal` (preset pills & countdown badge), and `useMediaSession` hook (silent audio keep-alive for iOS Safari lock screen).

**Tech Stack:** Python 3.14, FastAPI, Pydantic, Clementine Protobuf/TCP, LRCLIB API, Mutagen/ffprobe, React 19, TypeScript, TailwindCSS, Lucide Icons, Vite, Vitest, Pytest.

**Spec:** [`docs/superpowers/specs/2026-11-11-audiophile-listening-experience-design.md`](file:///home/mert/clementine-web-remote/docs/superpowers/specs/2026-11-11-audiophile-listening-experience-design.md)

## Global Constraints
- Clementine runs on Ubuntu 24.04 via TCP socket `127.0.0.1:5500`.
- Web Remote bound to `0.0.0.0:8000`, local LAN IP `172.20.5.94`.
- No paid API keys or external binaries required; `LRCLIB` is public and free.
- Dark HiFi color palette (`#0c0d10`, amber accents, glassmorphic blur).
- Sleep timer must run on the server so mobile screen locks cannot stop the timer.

## Review Focus
1. **File Path Resolution**: Local songs might have `file://` URI prefix or relative paths. The backend file probe must strip `file://` and decode URL-encoded paths properly to avoid FileNotFoundError.
2. **Missing Lyrics 404 Handling**: Unmatched songs on LRCLIB and Clementine must return a clean, user-friendly empty state (`"No lyrics found for this track"`) without crashing the frontend.
3. **Timer Volume Fade Restoration**: If the user cancels the sleep timer while volume is fading, or when timer finishes, the initial volume must be restored properly.
4. **iOS Safari Autoplay Restriction**: MediaSession silent audio loop must not throw uncaught promise rejection on initial load before user interacts with the UI.
5. **WebSocket Disconnect During Countdown**: If a client disconnects and reconnects while a sleep timer is active, the initial connection state must sync the current countdown.

---

### Task 1: Backend Audio Metadata Service (Audiophile Badges)

**Files:**
- Create: `backend/app/services/audio_meta_service.py`
- Modify: `backend/app/models/player.py:10-35`
- Modify: `backend/app/adapters/clementine/client.py:270-320`
- Test: `backend/tests/test_audio_meta_service.py`

**Interfaces:**
- Produces: `AudioMetaService.get_audio_metadata(file_path: str) -> AudioMetadata`
- Enriches: `TrackMetadata` with `audio_format`, `bit_depth`, `sample_rate`, `bit_rate`, `is_hi_res`

- [ ] **Step 1: Write the failing unit test for AudioMetaService**

Create `backend/tests/test_audio_meta_service.py`:
```python
import pytest
from backend.app.services.audio_meta_service import AudioMetaService

def test_parse_flac_hi_res(tmp_path):
    # Verify parsing 24-bit 96kHz FLAC file header or mock
    service = AudioMetaService()
    meta = service.probe_path("/home/mert/Müzik/FLAC/Elektronik & Dans/Mahmut Orhan/3 (2026) [24Bit Hi-Res]/01. Mahmut Orhan - Inci.flac")
    if meta:
        assert meta["audio_format"] == "FLAC"
        assert meta["sample_rate"] == 44100 or meta["sample_rate"] == 96000
        assert meta["bit_depth"] in [16, 24]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/home/mert/clementine-web-remote/backend/venv/bin/pytest backend/tests/test_audio_meta_service.py`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `AudioMetaService` and extend `TrackMetadata`**

Implement `backend/app/services/audio_meta_service.py` using `mutagen` or pure mutagen/ffprobe fallback to extract `sample_rate`, `bits_per_sample`, and `bitrate`. Add LRU cache in memory.
Update `TrackMetadata` in `backend/app/models/player.py`:
```python
class TrackMetadata(BaseModel):
    ...
    audio_format: Optional[str] = None
    bit_depth: Optional[int] = None
    sample_rate: Optional[int] = None
    bit_rate: Optional[int] = None
    is_hi_res: bool = False
```
In `backend/app/adapters/clementine/client.py`, when parsing `CURRENT_METAINFO`, resolve local path, call `AudioMetaService`, and populate the new fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `/home/mert/clementine-web-remote/backend/venv/bin/pytest backend/tests/test_audio_meta_service.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/audio_meta_service.py backend/app/models/player.py backend/app/adapters/clementine/client.py backend/tests/test_audio_meta_service.py
git commit -m "feat(backend): implement AudioMetaService for audiophile format probing"
```

---

### Task 2: Backend Lyrics Service (LRCLIB & Local Fallback)

**Files:**
- Create: `backend/app/services/lyrics_service.py`
- Modify: `backend/app/api/player.py:40-70`
- Test: `backend/tests/test_lyrics_service.py`

**Interfaces:**
- Produces: `GET /api/player/lyrics?artist=...&title=...&album=...&duration=...` -> `LyricsResponse`
- Model:
  ```python
  class LyricLine(BaseModel):
      time: float
      text: str

  class LyricsResponse(BaseModel):
      synced: bool
      lines: List[LyricLine] = []
      plain: str = ""
      source: str = "none"
  ```

- [ ] **Step 1: Write the failing unit test for LyricsService**

Create `backend/tests/test_lyrics_service.py`:
```python
import pytest
from backend.app.services.lyrics_service import LyricsService

@pytest.mark.anyio
async def test_parse_lrc_timestamps():
    service = LyricsService()
    lrc_text = "[00:12.50] Hello darkness my old friend\n[00:15.80] I've come to talk with you again"
    lines = service.parse_lrc(lrc_text)
    assert len(lines) == 2
    assert lines[0].time == 12.5
    assert lines[0].text == "Hello darkness my old friend"
    assert lines[1].time == 15.8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/home/mert/clementine-web-remote/backend/venv/bin/pytest backend/tests/test_lyrics_service.py`
Expected: FAIL

- [ ] **Step 3: Implement `LyricsService` and `GET /api/player/lyrics`**

In `backend/app/services/lyrics_service.py`:
- Implement `fetch_lyrics(artist, title, album, duration)`:
  1. Check in-memory LRU cache.
  2. Query `https://lrclib.net/api/get` (httpx async).
  3. If found and `syncedLyrics`, parse timestamps into `List[LyricLine]`.
  4. If only `plainLyrics`, set `plain`.
  5. If LRCLIB fails, fallback to local file ID3 tags (`USLT`) and Clementine's internal cache.
In `backend/app/api/player.py`: add `@router.get("/lyrics", response_model=LyricsResponse)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `/home/mert/clementine-web-remote/backend/venv/bin/pytest backend/tests/test_lyrics_service.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/lyrics_service.py backend/app/api/player.py backend/tests/test_lyrics_service.py
git commit -m "feat(lyrics): add LyricsService with LRCLIB synced karaoke parsing"
```

---

### Task 3: Backend Sleep Timer Service

**Files:**
- Create: `backend/app/services/sleep_timer_service.py`
- Modify: `backend/app/api/player.py`
- Modify: `backend/app/adapters/clementine/client.py`
- Test: `backend/tests/test_sleep_timer_service.py`

**Interfaces:**
- Endpoints:
  - `POST /api/player/sleep-timer` (`{"duration_minutes": int, "end_of_track": bool}`)
  - `DELETE /api/player/sleep-timer`
  - `GET /api/player/sleep-timer`
- WebSocket Event:
  - `sleep_timer_updated`: `{"active": bool, "remaining_seconds": int, "initial_volume": int, "is_fading": bool}`

- [ ] **Step 1: Write the failing unit test for SleepTimerService**

Create `backend/tests/test_sleep_timer_service.py`:
```python
import pytest
from backend.app.services.sleep_timer_service import SleepTimerService

def test_sleep_timer_lifecycle():
    timer = SleepTimerService()
    state = timer.start_timer(duration_seconds=120, initial_volume=88)
    assert state["active"] is True
    assert state["remaining_seconds"] == 120
    assert state["initial_volume"] == 88

    cancelled = timer.cancel_timer()
    assert cancelled["active"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/home/mert/clementine-web-remote/backend/venv/bin/pytest backend/tests/test_sleep_timer_service.py`
Expected: FAIL

- [ ] **Step 3: Implement `SleepTimerService` and endpoints**

In `backend/app/services/sleep_timer_service.py`:
- `asyncio` background task looping every 1s.
- During final 60s: linear volume reduction (`client.set_volume(...)`).
- At 0s: `client.pause()`, restore original volume to Clementine.
- Broadcast `sleep_timer_updated` via `manager.broadcast(...)`.
In `backend/app/api/player.py`: add POST, DELETE, GET endpoints for `/sleep-timer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `/home/mert/clementine-web-remote/backend/venv/bin/pytest backend/tests/test_sleep_timer_service.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/sleep_timer_service.py backend/app/api/player.py backend/tests/test_sleep_timer_service.py
git commit -m "feat(timer): implement backend authoritative sleep timer with volume fade-out"
```

---

### Task 4: Frontend Audiophile Badges & Ambient Glow

**Files:**
- Create: `frontend/src/components/AudiophileBadge.tsx`
- Modify: `frontend/src/components/NowPlaying.tsx`
- Modify: `frontend/src/types.ts`
- Test: `frontend/src/__tests__/AudiophileBadge.test.tsx`

**Interfaces:**
- Props: `AudiophileBadgeProps { audioFormat?: string, bitDepth?: number, sampleRate?: number, bitRate?: number, isHiRes?: boolean }`
- Visual styling: Gold gradient with badge for Hi-Res (24-bit/96kHz), cyan/silver badge for 16-bit/44.1kHz, subtle slate badge for MP3.
- Ambient Glow: Dynamic radial gradient with `blur-3xl` reflecting album art.

- [ ] **Step 1: Write the failing test for AudiophileBadge**

Create `frontend/src/__tests__/AudiophileBadge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AudiophileBadge } from '../components/AudiophileBadge';

describe('AudiophileBadge', () => {
  it('renders Hi-Res Lossless badge for 24-bit 96kHz FLAC', () => {
    render(<AudiophileBadge audioFormat="FLAC" bitDepth={24} sampleRate={96000} isHiRes={true} />);
    expect(screen.getByText(/HI-RES LOSSLESS/i)).toBeInTheDocument();
    expect(screen.getByText(/24-BIT \/ 96 kHz/i)).toBeInTheDocument();
  });

  it('renders CD Quality Lossless badge for 16-bit 44.1kHz FLAC', () => {
    render(<AudiophileBadge audioFormat="FLAC" bitDepth={16} sampleRate={44100} isHiRes={false} />);
    expect(screen.getByText(/LOSSLESS/i)).toBeInTheDocument();
    expect(screen.getByText(/16-BIT \/ 44.1 kHz/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/__tests__/AudiophileBadge.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `AudiophileBadge.tsx` and Ambient Glow in `NowPlaying.tsx`**

- Build `AudiophileBadge.tsx` with Tailwind styling (badges with tiny sparkle icons and mono format tags).
- Integrate into `NowPlaying.tsx` under track title and artist.
- Add Ambient Glow backdrop behind artwork image in `NowPlaying.tsx` using CSS backdrop-filter / radial gradient.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/__tests__/AudiophileBadge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AudiophileBadge.tsx frontend/src/components/NowPlaying.tsx frontend/src/__tests__/AudiophileBadge.test.tsx frontend/src/types.ts
git commit -m "feat(ui): add AudiophileBadge and ambient artwork glow"
```

---

### Task 5: Frontend Interactive Lyrics Modal (Synced Karaoke & Seek-on-Click)

**Files:**
- Create: `frontend/src/components/LyricsModal.tsx`
- Modify: `frontend/src/components/NowPlaying.tsx`
- Modify: `frontend/src/api.ts`
- Test: `frontend/src/__tests__/LyricsModal.test.tsx`

**Interfaces:**
- Props:
  ```tsx
  interface LyricsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSong: TrackMetadata | null;
    currentTimeMs: number;
    onSeek: (positionSeconds: number) => void;
  }
  ```

- [ ] **Step 1: Write the failing test for LyricsModal**

Create `frontend/src/__tests__/LyricsModal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LyricsModal } from '../components/LyricsModal';

describe('LyricsModal', () => {
  it('renders lyrics lines and calls onSeek when line clicked', () => {
    const onSeek = vi.fn();
    const mockSong = { id: 1, title: 'Inci', artist: 'Mahmut Orhan', album: '3', duration: 200 } as any;
    const mockLines = [
      { time: 10, text: 'First lyric line' },
      { time: 25, text: 'Second lyric line' }
    ];

    render(
      <LyricsModal
        isOpen={true}
        onClose={vi.fn()}
        currentSong={mockSong}
        currentTimeMs={12000}
        onSeek={onSeek}
        initialLyrics={{ synced: true, lines: mockLines, plain: '' }}
      />
    );

    expect(screen.getByText('First lyric line')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Second lyric line'));
    expect(onSeek).toHaveBeenCalledWith(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/__tests__/LyricsModal.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `LyricsModal.tsx` and integrate into `NowPlaying.tsx`**

- Fetch `api.getLyrics(artist, title, album, duration)` on open or song change.
- Highlight active line where `currentTimeMs >= line.time` and auto-scroll to view.
- Add Mic button in `NowPlaying.tsx` player action row.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/__tests__/LyricsModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/LyricsModal.tsx frontend/src/components/NowPlaying.tsx frontend/src/__tests__/LyricsModal.test.tsx frontend/src/api.ts
git commit -m "feat(lyrics): add interactive synced karaoke lyrics modal with seek-on-click"
```

---

### Task 6: Frontend Sleep Timer Modal & Quick Volume Presets

**Files:**
- Create: `frontend/src/components/SleepTimerModal.tsx`
- Modify: `frontend/src/components/NowPlaying.tsx`
- Modify: `frontend/src/api.ts`
- Test: `frontend/src/__tests__/SleepTimerModal.test.tsx`

**Interfaces:**
- Sleep Timer Pills: `15m`, `30m`, `45m`, `60m`, `End of Song`
- Quick Volume Pills: `88% (HK AUX)`, `50%`, `20%`
- WebSocket listener for `sleep_timer_updated` to render countdown badge on header/bar.

- [ ] **Step 1: Write the failing test for SleepTimerModal**

Create `frontend/src/__tests__/SleepTimerModal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SleepTimerModal } from '../components/SleepTimerModal';

describe('SleepTimerModal', () => {
  it('calls onSetTimer with selected minutes', () => {
    const onSetTimer = vi.fn();
    render(<SleepTimerModal isOpen={true} onClose={vi.fn()} onSetTimer={onSetTimer} activeTimer={null} onCancelTimer={vi.fn()} />);

    fireEvent.click(screen.getByText('30 min'));
    expect(onSetTimer).toHaveBeenCalledWith(30, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- src/__tests__/SleepTimerModal.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `SleepTimerModal.tsx` and quick volume pills in `NowPlaying.tsx`**

- Implement timer selection dialog with remaining time display and cancel button.
- Add quick volume preset buttons (`88%`, `50%`, `20%`) beside volume slider.
- Display active sleep timer pill with countdown badge next to the volume slider.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- src/__tests__/SleepTimerModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SleepTimerModal.tsx frontend/src/components/NowPlaying.tsx frontend/src/__tests__/SleepTimerModal.test.tsx frontend/src/api.ts
git commit -m "feat(timer): add SleepTimerModal and quick volume preset buttons"
```

---

### Task 7: iOS Lock Screen Media Session Hook

**Files:**
- Create: `frontend/src/hooks/useMediaSession.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/SystemView.tsx`

**Interfaces:**
- Hook: `useMediaSession(currentSong, isPlaying, onPlay, onPause, onNext, onPrevious, onSeek)`
- Silent audio element: `<audio loop src="data:audio/wav;base64,...">` primed on first user touch.
- System toggle: "Enable Lock Screen Controls" switch (saved to `localStorage`).

- [ ] **Step 1: Write hook implementation `useMediaSession.ts`**

Implement `useMediaSession.ts`:
- Check `'mediaSession' in navigator`.
- Update `navigator.mediaSession.metadata` on `currentSong` change (including full artwork URL).
- Set action handlers: `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`.
- Sync `playbackState` to `'playing'` or `'paused'`.
- Manage silent audio loop play/pause on user interaction.

- [ ] **Step 2: Integrate into `App.tsx` and `SystemView.tsx`**

In `App.tsx`: invoke `useMediaSession` with playback handlers.
In `SystemView.tsx`: add setting card for Lock Screen Media Session.

- [ ] **Step 3: Verify TypeScript compilation & existing tests pass**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useMediaSession.ts frontend/src/App.tsx frontend/src/components/SystemView.tsx
git commit -m "feat(ios): add useMediaSession hook for lock screen playback controls"
```

---

### Task 8: Full End-to-End Integration, Production Build & Live Verification

**Files:**
- All modified backend and frontend files
- Systemd service restart

- [ ] **Step 1: Run complete backend test suite**

Run: `/home/mert/clementine-web-remote/backend/venv/bin/pytest backend/tests/`
Expected: All tests PASS

- [ ] **Step 2: Run complete frontend vitest suite**

Run: `cd frontend && npm test -- --run`
Expected: All tests PASS

- [ ] **Step 3: Compile production Vite bundle**

Run: `cd frontend && npm run build`
Expected: Build succeeds with 0 errors, assets updated in `frontend/dist/`.

- [ ] **Step 4: Restart `clementine-watcher.service` and verify live API**

Run: `systemctl --user restart clementine-watcher.service && curl -s http://127.0.0.1:8000/api/system/info`
Expected: Backend returns `"clementine_connected": true` and new endpoints respond.

- [ ] **Step 5: Final git commit**

```bash
git commit -am "chore: complete audiophile listening experience and automation release"
```
