import React from 'react';
import { Play, Trash2, Disc } from 'lucide-react';
import { TrackMetadata, PlaylistInfo, PlayerStatus } from '../types';
import { api } from '../api';

interface PlaylistViewProps {
  playlist: PlaylistInfo | null;
  songs: TrackMetadata[];
  status: PlayerStatus | null;
  onRefresh?: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlist, songs, status }) => {
  const currentTrackIndex = status?.current_track?.index;
  const isPlaying = status?.state === 'Playing';

  const handlePlaySong = async (index: number) => {
    if (!playlist) return;
    await api.changeSong(playlist.id, index);
  };

  const handleRemoveSong = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (!playlist) return;
    await api.removeSongs(playlist.id, [index]);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 min-h-[calc(100vh-8rem)]">
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
                {/* Track Index / Equalizer Icon */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-hifi-800 flex items-center justify-center flex-shrink-0 text-xs font-mono">
                    {isCurrent && isPlaying ? (
                      <div className="flex items-end space-x-0.5 h-3">
                        <span className="w-0.5 h-3 bg-amber-500 animate-pulse"></span>
                        <span className="w-0.5 h-2 bg-amber-500 animate-pulse delay-75"></span>
                        <span className="w-0.5 h-3.5 bg-amber-500 animate-pulse delay-150"></span>
                      </div>
                    ) : isCurrent ? (
                      <Play className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    ) : (
                      <span className="text-neutral-400 group-hover:hidden">
                        {song.index + 1}
                      </span>
                    )}
                    {!isCurrent && (
                      <Play className="w-3.5 h-3.5 text-neutral-400 hidden group-hover:block" />
                    )}
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

                {/* Duration & Actions */}
                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className="text-xs font-mono text-neutral-400">
                    {song.pretty_length}
                  </span>
                  <button
                    onClick={(e) => handleRemoveSong(e, song.index)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition opacity-0 group-hover:opacity-100"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
