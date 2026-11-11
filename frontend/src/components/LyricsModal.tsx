import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic2, Loader2, Disc, RotateCcw } from 'lucide-react';
import { TrackMetadata, LyricsResponse } from '../types';
import { api } from '../api';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: TrackMetadata | null | undefined;
  currentPosition: number; // in seconds from status
  isPlaying?: boolean;
  onSeek: (position: number) => void;
}

const ANTICIPATION_SEC = 0.15; // 150ms vocal anticipation for natural singing onset

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  currentPosition,
  isPlaying = false,
  onSeek,
}) => {
  const [lyricsData, setLyricsData] = useState<LyricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState<number>(0); // manual sync offset in seconds
  const [smoothPosition, setSmoothPosition] = useState<number>(currentPosition);

  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const lastSyncPosRef = useRef<number>(currentPosition);
  const userInteractingRef = useRef<boolean>(false);
  const userScrollTimeoutRef = useRef<number | null>(null);

  // Storage key for persistent per-song offset calibration
  const storageKey = currentTrack
    ? `clementine_lrc_offset_${encodeURIComponent(currentTrack.artist || '')}_${encodeURIComponent(currentTrack.title || '')}`
    : null;

  // Load per-song offset from localStorage
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed)) {
            setOffset(parsed);
            return;
          }
        }
      } catch (e) {}
    }
    setOffset(0);
  }, [storageKey]);

  // Adjust offset and save
  const handleOffsetAdjust = (delta: number) => {
    setOffset((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      if (storageKey && typeof window !== 'undefined') {
        try {
          if (next === 0) {
            localStorage.removeItem(storageKey);
          } else {
            localStorage.setItem(storageKey, next.toString());
          }
        } catch (e) {}
      }
      return next;
    });
  };

  const handleResetOffset = () => {
    setOffset(0);
    if (storageKey && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
  };

  // Sync position from parent status
  useEffect(() => {
    lastSyncTimeRef.current = Date.now();
    lastSyncPosRef.current = currentPosition;
    setSmoothPosition(currentPosition);
  }, [currentPosition]);

  // High-frequency (50ms) position interpolation during playback
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - lastSyncTimeRef.current) / 1000;
      setSmoothPosition(lastSyncPosRef.current + elapsed);
    }, 50);

    return () => window.clearInterval(interval);
  }, [isOpen, isPlaying]);

  // Fetch lyrics when track changes or modal opens
  useEffect(() => {
    if (!isOpen || !currentTrack) {
      setLyricsData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    api
      .getLyrics(currentTrack.artist, currentTrack.title, currentTrack.album, currentTrack.length)
      .then((data) => {
        if (isMounted) {
          setLyricsData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.debug('Failed to load lyrics:', err);
          setLyricsData({
            synced: false,
            lines: [],
            plain: '',
            source: 'none',
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentTrack?.title, currentTrack?.artist]);

  // Calculate effective position with user offset and singing anticipation
  const effectivePosition = smoothPosition + offset + ANTICIPATION_SEC;

  // Find active line index
  let activeIndex = -1;
  if (lyricsData?.synced && lyricsData.lines.length > 0) {
    for (let i = 0; i < lyricsData.lines.length; i++) {
      const lineTime = lyricsData.lines[i].time;
      const nextTime = lyricsData.lines[i + 1]?.time ?? Infinity;
      if (effectivePosition >= lineTime && effectivePosition < nextTime) {
        activeIndex = i;
        break;
      }
    }
    // If past the last timestamp, keep the last line active
    if (activeIndex === -1 && effectivePosition >= lyricsData.lines[lyricsData.lines.length - 1].time) {
      activeIndex = lyricsData.lines.length - 1;
    }
  }

  // Handle user manual scroll: temporarily suspend auto-scroll for 3.5 seconds
  const markUserInteraction = useCallback(() => {
    userInteractingRef.current = true;
    if (userScrollTimeoutRef.current) {
      window.clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      userInteractingRef.current = false;
    }, 3500);
  }, []);

  // Auto-scroll to active line if user is not actively browsing
  useEffect(() => {
    if (
      !userInteractingRef.current &&
      activeLineRef.current &&
      typeof activeLineRef.current.scrollIntoView === 'function'
    ) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg h-[84vh] flex flex-col bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10 bg-neutral-900/90 z-10 flex-shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 flex-shrink-0">
              <Mic2 className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {currentTrack?.title || 'Şarkı Sözleri'}
              </h3>
              <p className="text-xs text-neutral-400 truncate">
                {currentTrack?.artist || 'Bilinmeyen Sanatçı'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {lyricsData?.synced && (
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Karaoke
              </span>
            )}
            <button
              onClick={onClose}
              title="Kapat"
              aria-label="Kapat"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Calibration Sub-Bar (only shown if synced lyrics are available) */}
        {lyricsData?.synced && lyricsData.lines.length > 0 && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-1.5 bg-neutral-950/60 border-b border-white/5 text-[11px] text-neutral-400">
            <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider">
              Senkron Kalibrasyonu
            </span>
            <div className="flex items-center space-x-1.5 font-mono">
              <button
                onClick={() => handleOffsetAdjust(-0.5)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 active:scale-95 transition"
                title="Sözleri 0.5 saniye erkene al"
              >
                -0.5s
              </button>
              <button
                onClick={handleResetOffset}
                className={`px-2 py-0.5 rounded transition ${
                  offset !== 0
                    ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                    : 'bg-white/5 text-neutral-400'
                }`}
                title="Sıfırla"
              >
                {offset > 0 ? `+${offset.toFixed(1)}s` : `${offset.toFixed(1)}s`}
              </button>
              <button
                onClick={() => handleOffsetAdjust(0.5)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 active:scale-95 transition"
                title="Sözleri 0.5 saniye geciktir"
              >
                +0.5s
              </button>
              {offset !== 0 && (
                <button
                  onClick={handleResetOffset}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-300 transition"
                  title="Ofseti Sıfırla"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div
          ref={containerRef}
          onScroll={markUserInteraction}
          onTouchStart={markUserInteraction}
          onWheel={markUserInteraction}
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 scroll-smooth space-y-3"
        >
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm">Şarkı sözleri aranıyor...</p>
            </div>
          ) : lyricsData?.synced && lyricsData.lines.length > 0 ? (
            <div className="flex flex-col space-y-3 py-6">
              {lyricsData.lines.map((line, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`${line.time}-${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => {
                      const seekTarget = Math.max(0, line.time - offset);
                      lastSyncPosRef.current = seekTarget;
                      lastSyncTimeRef.current = Date.now();
                      setSmoothPosition(seekTarget);
                      onSeek(seekTarget);
                    }}
                    className={`text-left w-full transition-all duration-300 px-3.5 py-2.5 rounded-2xl cursor-pointer ${
                      isActive
                        ? 'text-amber-400 font-bold text-lg sm:text-xl scale-[1.02] bg-amber-500/15 border border-amber-500/20 shadow-md shadow-amber-500/5'
                        : 'text-neutral-400 hover:text-neutral-200 text-sm sm:text-base hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {line.text || '♪'}
                  </button>
                );
              })}
            </div>
          ) : lyricsData?.plain ? (
            <div className="text-neutral-200 text-sm sm:text-base leading-relaxed whitespace-pre-line py-4">
              {lyricsData.plain}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-2">
              <Disc className="w-12 h-12 stroke-1" />
              <p className="text-sm">Bu parça için şarkı sözü bulunamadı.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
