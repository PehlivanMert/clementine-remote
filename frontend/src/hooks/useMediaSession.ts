import { useEffect, useRef } from 'react';
import { PlayerStatus } from '../types';
import { api } from '../api';

export function useMediaSession(status: PlayerStatus | null) {
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Initialize and maintain silent audio element for iOS Safari background wakefulness
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (!silentAudioRef.current) {
      const audio = new Audio('/silence.mp3');
      audio.loop = true;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
      audio.volume = 0.01; // Inaudible keepalive stream
      silentAudioRef.current = audio;
    }

    const audio = silentAudioRef.current;

    // Attach interaction handlers to prime and resume audio on user gestures
    const handleInteraction = () => {
      if (audio && status?.state === 'Playing' && audio.paused) {
        try {
          const p = audio.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
    };

    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('pointerdown', handleInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
    };
  }, [status?.state]);

  // 2. Sync silent audio playing state with Clementine status
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

  // 3. Register static Media Session action handlers ONCE (never re-bind per second tick)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      [
        'play',
        async () => {
          await api.play();
          if (silentAudioRef.current && silentAudioRef.current.paused) {
            try {
              const p = silentAudioRef.current.play();
              if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch (e) {}
          }
        },
      ],
      [
        'pause',
        async () => {
          await api.pause();
          if (silentAudioRef.current && !silentAudioRef.current.paused) {
            try {
              silentAudioRef.current.pause();
            } catch (e) {}
          }
        },
      ],
      ['previoustrack', async () => api.previous()],
      ['nexttrack', async () => api.next()],
      [
        'seekto',
        async (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            await api.seek(Math.floor(details.seekTime));
          }
        },
      ],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {}
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (error) {}
      });
    };
  }, []);

  // 4. Update track metadata ONLY when track title/artist/album changes (STABLE - prevents Dynamic Island spinning/flickering)
  const currentTrack = status?.current_track;
  const trackTitle = currentTrack?.title || '';
  const trackArtist = currentTrack?.artist || '';
  const trackAlbum = currentTrack?.album || '';

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (trackTitle || trackArtist) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const artBuster = encodeURIComponent(`${trackArtist}-${trackTitle}`);
      const artworkUrl = `${origin}/api/artwork/current?t=${artBuster}`;

      const metadataObj = {
        title: trackTitle || 'Clementine Player',
        artist: trackArtist || 'Clementine',
        album: trackAlbum || '',
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
  }, [trackTitle, trackArtist, trackAlbum]);

  // 5. Update playback state (playing / paused)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const isPlaying = status?.state === 'Playing';
    navigator.mediaSession.playbackState = isPlaying
      ? 'playing'
      : status?.state === 'Paused'
      ? 'paused'
      : 'none';
  }, [status?.state]);

  // 6. Update position scrubber state ONLY (isolated from metadata to avoid artwork refresh loops)
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }

    const isPlaying = status?.state === 'Playing';
    if (
      status?.duration &&
      status.duration > 0 &&
      typeof status?.position === 'number' &&
      status.position >= 0
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: status.duration,
          playbackRate: isPlaying ? 1.0 : 0.0,
          position: Math.min(Math.max(0, status.position), status.duration),
        });
      } catch (e) {}
    }
  }, [status?.position, status?.duration, status?.state]);
}
