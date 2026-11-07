import React, { useState } from 'react';
import { Play, Trash2, Disc, AlertTriangle } from 'lucide-react';
import { TrackMetadata, PlaylistInfo, PlayerStatus } from '../types';
import { api } from '../api';

interface PlaylistViewProps {
  playlist: PlaylistInfo | null;
  songs: TrackMetadata[];
  status: PlayerStatus | null;
  onRefresh?: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlist, songs, status }) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const currentTrackIndex = status?.current_track?.index;
  const isPlaying = status?.state === 'Playing';

  const handlePlaySong = async (index: number) => {
    const targetPlId = playlist?.id ?? 1;
    await api.changeSong(targetPlId, index);
  };

  const handleRemoveSong = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const targetPlId = playlist?.id ?? 1;
    await api.removeSongs(targetPlId, [index]);
  };

  const handleClearPlaylist = async () => {
    setIsClearing(true);
    try {
      await api.clearPlaylist(playlist?.id);
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Failed to clear playlist", err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-md landscape:max-w-4xl mx-auto px-4 py-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>{playlist?.name || 'Now Playing Queue'}</span>
          </h2>
          <p className="text-xs text-neutral-400">
            {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
          </p>
        </div>

        {songs.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 active:scale-95 transition"
            title="Clear Queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Queue</span>
          </button>
        )}
      </div>

      {/* Song List */}
      {songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
          <Disc className="w-12 h-12 stroke-1 mb-2 opacity-50" />
          <p className="text-sm font-medium">The queue is empty</p>
          <p className="text-xs text-neutral-400 mt-1">Browse your library to add music</p>
        </div>
      ) : (
        <div className="space-y-1.5 pb-20">
          {songs.map((song) => {
            const isCurrent = currentTrackIndex === song.index;
            const artSrc = (song.filename || song.url)
              ? `/api/artwork/file?path=${encodeURIComponent(song.url || song.filename || '')}&thumb=true`
              : null;

            return (
              <div
                key={`${song.index}-${song.title}`}
                onClick={() => handlePlaySong(song.index)}
                className={`group flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer border ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/30 text-white'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] text-neutral-300'
                }`}
              >
                {/* Track Thumbnail & Equalizer */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="relative w-10 h-10 rounded-lg bg-hifi-800 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {artSrc ? (
                      <img
                        src={artSrc}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Disc className="w-5 h-5 text-neutral-600" />
                    )}

                    {/* Overlay badge for current playing track */}
                    {isCurrent && isPlaying ? (
                      <div className="absolute inset-0 bg-black/60 flex items-end justify-center pb-2 space-x-0.5">
                        <span className="w-0.5 h-3 bg-amber-400 animate-pulse"></span>
                        <span className="w-0.5 h-2 bg-amber-400 animate-pulse delay-75"></span>
                        <span className="w-0.5 h-3.5 bg-amber-400 animate-pulse delay-150"></span>
                      </div>
                    ) : isCurrent ? (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
                      </div>
                    ) : null}
                  </div>

                  {/* Title & Artist */}
                  <div className="min-w-0 flex-1 pr-2">
                    <p className={`text-sm font-medium truncate ${isCurrent ? 'text-amber-400 font-semibold' : 'text-neutral-200'}`}>
                      {song.title}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {song.artist || 'Unknown Artist'} {song.album ? `• ${song.album}` : ''}
                    </p>
                  </div>
                </div>

                {/* Duration & Touch-Accessible Delete Button */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className="text-xs font-mono text-neutral-400">
                    {song.pretty_length}
                  </span>
                  <button
                    onClick={(e) => handleRemoveSong(e, song.index)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition opacity-80 group-hover:opacity-100"
                    title="Remove from queue"
                    aria-label={`Remove ${song.title} from queue`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Clear Playlist */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-hifi-800 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Clear Queue?</h3>
              <p className="text-xs text-neutral-400">
                Are you sure you want to remove all {songs.length} tracks from '{playlist?.name || 'Now Playing Queue'}'?
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold transition"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={handleClearPlaylist}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear Queue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
