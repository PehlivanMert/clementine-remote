import { useEffect, useRef } from 'react';
import { PlayerStatus } from '../types';
import { api } from '../api';

// 1-second silent WAV data URI for iOS Safari AudioSession keepalive
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function useMediaSession(status: PlayerStatus | null) {
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize silent audio element for iOS Safari background wakefulness
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (!silentAudioRef.current) {
      const audio = new Audio(SILENT_AUDIO_URI);
      audio.loop = true;
      audio.volume = 0.001; // virtually inaudible
      silentAudioRef.current = audio;
    }

    const audio = silentAudioRef.current;

    // First user gesture primes audio playback
    const primeAudio = () => {
      if (audio && audio.paused && status?.state === 'Playing') {
        try {
          const p = audio.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
      window.removeEventListener('click', primeAudio);
      window.removeEventListener('touchstart', primeAudio);
    };

    window.addEventListener('click', primeAudio, { once: true });
    window.addEventListener('touchstart', primeAudio, { once: true });

    return () => {
      window.removeEventListener('click', primeAudio);
      window.removeEventListener('touchstart', primeAudio);
    };
  }, [status?.state]);

  // Sync silent audio playing state
  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;

    if (status?.state === 'Playing') {
      try {
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    } else {
      try {
        audio.pause();
      } catch (e) {}
    }
  }, [status?.state]);

  // Register Media Session metadata and actions
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const currentTrack = status?.current_track;
    const isPlaying = status?.state === 'Playing';

    // Update metadata
    if (currentTrack) {
      const artworkUrl = `${window.location.origin}/api/artwork/current`;

      const metadataObj = {
        title: currentTrack.title || 'Clementine Player',
        artist: currentTrack.artist || 'Bilinmeyen Sanatçı',
        album: currentTrack.album || '',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      };

      try {
        if (typeof window.MediaMetadata !== 'undefined') {
          navigator.mediaSession.metadata = new window.MediaMetadata(metadataObj);
        } else {
          navigator.mediaSession.metadata = metadataObj as any;
        }
      } catch (e) {
        navigator.mediaSession.metadata = metadataObj as any;
      }
    } else {
      navigator.mediaSession.metadata = null;
    }

    // Update playback state
    navigator.mediaSession.playbackState = isPlaying
      ? 'playing'
      : status?.state === 'Paused'
      ? 'paused'
      : 'none';

    // Update position state
    if (
      'setPositionState' in navigator.mediaSession &&
      typeof navigator.mediaSession.setPositionState === 'function' &&
      status?.duration &&
      status.duration > 0
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: status.duration,
          playbackRate: 1.0,
          position: Math.min(status.position, status.duration),
        });
      } catch (e) {
        // Ignore potential position bounds errors
      }
    }

    // Set action handlers
    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => api.play()],
      ['pause', () => api.pause()],
      ['previoustrack', () => api.previous()],
      ['nexttrack', () => api.next()],
      [
        'seekto',
        (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            api.seek(Math.floor(details.seekTime));
          }
        },
      ],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // Some browsers do not support all media actions
      }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (error) {}
      });
    };
  }, [
    status?.current_track?.title,
    status?.current_track?.artist,
    status?.current_track?.album,
    status?.state,
    status?.duration,
    status?.position,
  ]);
}
