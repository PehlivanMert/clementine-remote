import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMediaSession } from '../hooks/useMediaSession';
import { PlayerStatus } from '../types';

vi.mock('../api', () => ({
  api: {
    play: vi.fn(),
    pause: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    seek: vi.fn(),
  },
}));

describe('useMediaSession Hook', () => {
  let mockMediaSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMediaSession = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
    };

    // Mock navigator.mediaSession
    Object.defineProperty(navigator, 'mediaSession', {
      value: mockMediaSession,
      writable: true,
      configurable: true,
    });
  });

  it('updates metadata when track changes', () => {
    const status: PlayerStatus = {
      state: 'Playing',
      current_track: {
        index: 0,
        title: 'Comfortably Numb',
        artist: 'Pink Floyd',
        album: 'The Wall',
        length: 382,
        pretty_length: '6:22',
        is_local: true,
      },
      position: 120,
      duration: 382,
      volume: 70,
      repeat_mode: 0,
      shuffle_mode: 0,
      clementine_connected: true,
      clementine_version: '1.4',
    };

    renderHook(() => useMediaSession(status));

    expect(mockMediaSession.metadata).not.toBeNull();
    expect(mockMediaSession.metadata.title).toBe('Comfortably Numb');
    expect(mockMediaSession.metadata.artist).toBe('Pink Floyd');
    expect(mockMediaSession.metadata.album).toBe('The Wall');
    expect(mockMediaSession.playbackState).toBe('playing');
  });

  it('registers media action handlers', () => {
    const status: PlayerStatus = {
      state: 'Playing',
      current_track: null,
      position: 0,
      duration: 0,
      volume: 70,
      repeat_mode: 0,
      shuffle_mode: 0,
      clementine_connected: true,
      clementine_version: '1.4',
    };

    renderHook(() => useMediaSession(status));

    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('previoustrack', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('seekto', expect.any(Function));
  });
});
