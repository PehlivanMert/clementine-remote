import React, { useState, useEffect, useRef } from 'react';
import { X, Mic2, Loader2, Disc } from 'lucide-react';
import { TrackMetadata, LyricsResponse } from '../types';
import { api } from '../api';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: TrackMetadata | null | undefined;
  currentPosition: number; // in seconds
  onSeek: (position: number) => void;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  currentPosition,
  onSeek,
}) => {
  const [lyricsData, setLyricsData] = useState<LyricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Find active line index
  let activeIndex = -1;
  if (lyricsData?.synced && lyricsData.lines.length > 0) {
    for (let i = 0; i < lyricsData.lines.length; i++) {
      const lineTime = lyricsData.lines[i].time;
      const nextTime = lyricsData.lines[i + 1]?.time ?? Infinity;
      if (currentPosition >= lineTime && currentPosition < nextTime) {
        activeIndex = i;
        break;
      }
    }
  }

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && typeof activeLineRef.current.scrollIntoView === 'function') {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg h-[80vh] flex flex-col bg-neutral-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-neutral-900/90 z-10 flex-shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Mic2 className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-base font-bold text-white truncate">
                {currentTrack?.title || 'Şarkı Sözleri'}
              </h3>
              <p className="text-xs text-neutral-400 truncate">
                {currentTrack?.artist || 'Bilinmeyen Sanatçı'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {lyricsData?.synced && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
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

        {/* Content Body */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth space-y-4"
        >
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm">Şarkı sözleri aranıyor...</p>
            </div>
          ) : lyricsData?.synced && lyricsData.lines.length > 0 ? (
            <div className="flex flex-col space-y-4 py-8">
              {lyricsData.lines.map((line, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`${line.time}-${idx}`}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => onSeek(line.time)}
                    className={`text-left w-full transition-all duration-300 px-3 py-2 rounded-xl ${
                      isActive
                        ? 'text-amber-400 font-bold text-lg sm:text-xl scale-105 bg-amber-500/10 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200 text-sm sm:text-base hover:bg-white/5'
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
