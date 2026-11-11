import { useEffect, useRef } from 'react';
import { PlayerStatus } from '../types';
import { api } from '../api';

export function useMediaSession(status: PlayerStatus | null) {
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize and maintain silent audio element for iOS Safari background wakefulness
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (!silentAudioRef.current) {
      const audio = new Audio('/silence.mp3');
      audio.loop = true;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
      audio.volume = 0.01; // Audible to media system, silent to human ear
      silentAudioRef.current = audio;
    }

    const audio = silentAudioRef.current;

    // Attach interaction handlers to unlock and resume audio on ANY user tap
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

  // Sync silent audio playing state with Clementine status
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
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const artBuster = encodeURIComponent(`${currentTrack.artist}-${currentTrack.title}`);
      const artworkUrl = `${origin}/api/artwork/current?t=${artBuster}`;

      const metadataObj = {
        title: currentTrack.title || 'Clementine Player',
        artist: currentTrack.artist || 'Clementine',
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

    // Action handlers with direct playback sync
    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      [
        'play',
        async () => {
          await api.play();
          if (silentAudioRef.current) {
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
          if (silentAudioRef.current) {
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
  }, [
    status?.current_track?.title,
    status?.current_track?.artist,
    status?.current_track?.album,
    status?.state,
    status?.duration,
    status?.position,
  ]);
}
