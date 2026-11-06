import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Music,
} from 'lucide-react';
import { PlayerStatus } from '../types';
import { api } from '../api';

interface NowPlayingProps {
  status: PlayerStatus | null;
  onRefresh?: () => void;
}

export const NowPlaying: React.FC<NowPlayingProps> = ({ status }) => {
  const [seeking, setSeeking] = useState(false);
  const [seekVal, setSeekVal] = useState(0);
  const [artCacheBuster, setArtCacheBuster] = useState(Date.now());

  const currentTrack = status?.current_track;
  const isPlaying = status?.state === 'Playing';
  const duration = status?.duration || currentTrack?.length || 0;
  const currentPos = seeking ? seekVal : (status?.position || 0);

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
    setSeeking(false);
    await api.seek(seekVal);
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    await api.setVolume(val);
  };

  const toggleMute = async () => {
    const newVol = (status?.volume || 0) > 0 ? 0 : 75;
    await api.setVolume(newVol);
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
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-8rem)] px-4 py-4 max-w-sm mx-auto select-none">
      {/* Album Artwork Frame with Glow */}
      <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[320px] my-auto">
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 to-orange-500/10 rounded-3xl blur-2xl transform scale-95" />
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
              <Music className="w-16 h-16 stroke-1 mb-2" />
              <span className="text-xs uppercase tracking-wider">No Track Playing</span>
            </div>
          )}
        </div>
      </div>

      {/* Track Info */}
      <div className="w-full text-center mt-3 mb-2 px-2">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
          {currentTrack?.title || 'Ready to Play'}
        </h2>
        <p className="text-sm font-medium text-amber-500/90 truncate mt-0.5">
          {currentTrack?.artist || 'Clementine Player'}
        </p>
        <p className="text-xs text-neutral-400 truncate mt-0.5">
          {currentTrack?.album || 'Idle'}
        </p>
      </div>

      {/* Scrubber / Progress Bar */}
      <div className="w-full mt-2 mb-3">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentPos}
          onChange={(e) => {
            setSeeking(true);
            setSeekVal(parseInt(e.target.value, 10));
          }}
          onMouseUp={handleSeekCommit}
          onTouchEnd={handleSeekCommit}
          className="w-full"
        />
        <div className="flex justify-between text-[11px] font-mono text-neutral-400 mt-1">
          <span>{formatTime(currentPos)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="w-full flex items-center justify-between px-2 mb-4">
        {/* Shuffle */}
        <button
          onClick={cycleShuffle}
          className={`p-2 rounded-full transition ${
            (status?.shuffle_mode || 0) > 0
              ? 'text-amber-500 bg-amber-500/10'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Shuffle"
        >
          <Shuffle className="w-5 h-5" />
        </button>

        {/* Previous */}
        <button
          onClick={() => api.previous()}
          className="p-3 rounded-full text-neutral-200 hover:text-white hover:bg-white/5 active:scale-95 transition"
          title="Previous"
        >
          <SkipBack className="w-6 h-6 fill-current" />
        </button>

        {/* Play / Pause Hero Button */}
        <button
          onClick={() => api.playPause()}
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-black flex items-center justify-center shadow-lg shadow-amber-500/25 active:scale-95 hover:scale-105 transition"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-black stroke-black" />
          ) : (
            <Play className="w-7 h-7 fill-black stroke-black ml-1" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={() => api.next()}
          className="p-3 rounded-full text-neutral-200 hover:text-white hover:bg-white/5 active:scale-95 transition"
          title="Next"
        >
          <SkipForward className="w-6 h-6 fill-current" />
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
        >
          <Repeat className="w-5 h-5" />
          {status?.repeat_mode === 1 && (
            <span className="absolute text-[8px] font-bold bottom-1 right-1">1</span>
          )}
        </button>
      </div>

      {/* Volume Slider Bar */}
      <div className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
        <button onClick={toggleMute} className="text-neutral-400 hover:text-white transition">
          {(status?.volume || 0) === 0 ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={status?.volume || 0}
          onChange={handleVolumeChange}
          className="flex-1 accent-amber-500 h-1.5"
        />
        <span className="text-xs font-mono text-neutral-400 w-8 text-right">
          {status?.volume || 0}%
        </span>
      </div>
    </div>
  );
};
