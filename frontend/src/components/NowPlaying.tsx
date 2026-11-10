import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Volume1,
  Music,
  Plus,
  Minus,
  Mic2,
} from 'lucide-react';
import { PlayerStatus } from '../types';
import { api } from '../api';
import { AudiophileBadge } from './AudiophileBadge';
import { LyricsModal } from './LyricsModal';

interface NowPlayingProps {
  status: PlayerStatus | null;
  onRefresh?: () => void;
}

export const NowPlaying: React.FC<NowPlayingProps> = ({ status }) => {
  const [seeking, setSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);
  const [artCacheBuster, setArtCacheBuster] = useState(Date.now());
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const lastUnmutedVolume = useRef<number>(75);
  const seekLockTimer = useRef<number | null>(null);

  const currentTrack = status?.current_track;
  const isPlaying = status?.state === 'Playing';
  const duration = status?.duration || currentTrack?.length || 0;
  const currentPos = seeking ? seekVal : (status?.position || 0);

  // Track last unmuted volume
  useEffect(() => {
    if (status?.volume && status.volume > 0) {
      lastUnmutedVolume.current = status.volume;
    }
  }, [status?.volume]);

  // Update art when track changes
  useEffect(() => {
    setArtCacheBuster(Date.now());
  }, [currentTrack?.title, currentTrack?.artist]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeekCommit = async () => {
    const targetSeek = seekVal;
    await api.seek(targetSeek);
    // Keep lock active briefly to prevent UI snap-back before socket syncs
    if (seekLockTimer.current) clearTimeout(seekLockTimer.current);
    seekLockTimer.current = window.setTimeout(() => {
      setSeeking(false);
    }, 600);
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    await api.setVolume(val);
  };

  const handleVolumeStep = async (step: number) => {
    const cur = status?.volume ?? 50;
    const nextVol = Math.max(0, Math.min(100, cur + step));
    await api.setVolume(nextVol);
  };

  const toggleMute = async () => {
    const currentVol = status?.volume || 0;
    if (currentVol > 0) {
      lastUnmutedVolume.current = currentVol;
      await api.setVolume(0);
    } else {
      await api.setVolume(lastUnmutedVolume.current || 75);
    }
  };

  const cycleShuffle = async () => {
    // 0: Off, 1: All
    const nextMode = (status?.shuffle_mode || 0) === 0 ? 1 : 0;
    await api.setShuffle(nextMode);
  };

  const cycleRepeat = async () => {
    // 0: Off, 1: Track, 3: Playlist
    const currentMode = status?.repeat_mode || 0;
    const nextMode = currentMode === 0 ? 3 : currentMode === 3 ? 1 : 0;
    await api.setRepeat(nextMode);
  };

  const artUrl = currentTrack
    ? `/api/artwork/current?t=${artCacheBuster}`
    : '/icons/clementine-icon.svg';

  return (
    <div className="w-full max-w-sm landscape:max-w-4xl mx-auto h-full flex flex-col landscape:flex-row items-center justify-between landscape:justify-center landscape:items-center px-4 py-2 select-none landscape:gap-8 flex-1">
      {/* Album Artwork Frame with Glow */}
      <div className="relative flex-1 min-h-0 landscape:flex-initial landscape:h-full w-full flex items-center justify-center my-1 landscape:my-0 overflow-hidden">
        <div className="relative w-auto h-full max-h-[36vh] max-w-[76vw] landscape:max-h-[72vh] landscape:max-w-none aspect-square flex items-center justify-center">
          {/* Dynamic Ambient Album Art Glow */}
          {currentTrack && (
            <img
              src={artUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover rounded-3xl blur-2xl opacity-45 transform scale-110 pointer-events-none transition-opacity duration-700"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-orange-500/10 rounded-3xl blur-2xl transform scale-95 pointer-events-none" />
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-hifi-800 shadow-2xl border border-white/10 flex items-center justify-center">
            {currentTrack ? (
              <img
                src={artUrl}
                alt={currentTrack.album || 'Cover'}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icons/clementine-icon.svg';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-500">
                <Music className="w-14 h-14 stroke-1 mb-2" />
                <span className="text-[11px] uppercase tracking-wider">No Track Playing</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column / Controls Container */}
      <div className="w-full landscape:flex-1 landscape:max-w-md flex flex-col justify-end landscape:justify-center flex-shrink-0 landscape:space-y-1">
        {/* Track Info */}
        <div className="w-full text-center landscape:text-left mt-2 landscape:mt-0 mb-1 px-1">
          <h2 className="text-lg sm:text-xl landscape:text-base font-bold tracking-tight text-white truncate">
            {currentTrack?.title || 'Ready to Play'}
          </h2>
          <p className="text-sm landscape:text-xs font-medium text-amber-500/90 truncate mt-0.5">
            {currentTrack?.artist || 'Clementine Player'}
          </p>
          <p className="text-xs landscape:text-[11px] text-neutral-400 truncate mt-0.5">
            {currentTrack?.album || 'Idle'}
          </p>
          <div className="flex items-center justify-center landscape:justify-start gap-2 mt-1.5 flex-wrap">
            <AudiophileBadge track={currentTrack} />
            {currentTrack && (
              <button
                onClick={() => setIsLyricsOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-neutral-300 hover:text-amber-300 bg-white/5 hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/30 transition backdrop-blur-sm cursor-pointer active:scale-95"
                title="Şarkı Sözleri (Lyrics)"
                aria-label="Şarkı Sözlerini Aç"
              >
                <Mic2 className="w-3 h-3 text-amber-400" />
                <span>Sözler</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrubber / Progress Bar */}
        <div className="w-full my-1.5 landscape:my-1 px-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentPos}
            onPointerDown={() => setSeeking(true)}
            onChange={(e) => {
              setSeeking(true);
              setSeekVal(parseInt(e.target.value, 10));
            }}
            onPointerUp={handleSeekCommit}
            className="w-full"
            aria-label="Progress scrubber"
          />
          <div className="flex justify-between text-[11px] landscape:text-[10px] font-mono text-neutral-400 mt-1">
            <span>{formatTime(currentPos)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="w-full flex items-center justify-between px-1 my-2 landscape:my-1">
          {/* Shuffle */}
          <button
            onClick={cycleShuffle}
            className={`p-2 rounded-full transition ${
              (status?.shuffle_mode || 0) > 0
                ? 'text-amber-500 bg-amber-500/10'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Shuffle"
            aria-label="Toggle shuffle"
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Previous */}
          <button
            onClick={() => api.previous()}
            className="p-2.5 sm:p-3 rounded-full text-neutral-200 hover:text-white hover:bg-white/5 active:scale-95 transition"
            title="Previous"
            aria-label="Previous track"
          >
            <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          </button>

          {/* Play / Pause Hero Button */}
          <button
            onClick={() => api.playPause()}
            className="w-14 h-14 sm:w-16 sm:h-16 landscape:w-11 landscape:h-11 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-black flex items-center justify-center shadow-lg shadow-amber-500/25 active:scale-95 hover:scale-105 transition"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 landscape:w-5 landscape:h-5 fill-black stroke-black" />
            ) : (
              <Play className="w-6 h-6 landscape:w-5 landscape:h-5 fill-black stroke-black ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={() => api.next()}
            className="p-2.5 sm:p-3 rounded-full text-neutral-200 hover:text-white hover:bg-white/5 active:scale-95 transition"
            title="Next"
            aria-label="Next track"
          >
            <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            className={`p-2 rounded-full transition relative ${
              (status?.repeat_mode || 0) > 0
                ? 'text-amber-500 bg-amber-500/10'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Repeat"
            aria-label="Toggle repeat"
          >
            <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
            {status?.repeat_mode === 1 && (
              <span className="absolute text-[8px] font-bold bottom-1 right-1">1</span>
            )}
          </button>
        </div>

        {/* Ultra-Minimal Low-Profile Volume Bar */}
        <div className="w-full px-1.5 mt-0.5 mb-5 landscape:mb-0">
          <div className="w-full flex items-center space-x-1.5 sm:space-x-2 py-0.5 landscape:py-0">
            <button
              onClick={toggleMute}
              className="p-1 rounded-md text-neutral-400 hover:text-amber-400 transition active:scale-95 flex-shrink-0"
              title={status?.volume === 0 ? "Unmute" : "Mute"}
              aria-label={status?.volume === 0 ? "Unmute" : "Mute"}
            >
              {(status?.volume || 0) === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (status?.volume || 0) < 50 ? (
                <Volume1 className="w-4 h-4 text-neutral-400 hover:text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-neutral-400 hover:text-white" />
              )}
            </button>

            <button
              onClick={() => handleVolumeStep(-5)}
              className="p-1 rounded text-neutral-500 hover:text-neutral-300 active:scale-90 transition flex-shrink-0"
              title="Volume Down"
              aria-label="Decrease volume by 5%"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={0}
              max={100}
              value={status?.volume || 0}
              onChange={handleVolumeChange}
              className="flex-1 volume-slider"
              aria-label="Volume slider"
            />

            <button
              onClick={() => handleVolumeStep(5)}
              className="p-1 rounded text-neutral-500 hover:text-neutral-300 active:scale-90 transition flex-shrink-0"
              title="Volume Up"
              aria-label="Increase volume by 5%"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono text-neutral-400 w-7 text-right select-none flex-shrink-0">
              {status?.volume || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Lyrics Modal */}
      <LyricsModal
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
        currentTrack={currentTrack}
        currentPosition={currentPos}
        onSeek={async (pos) => {
          await api.seek(Math.floor(pos));
        }}
      />
    </div>
  );
};
