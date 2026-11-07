import React, { useState } from 'react';
import { Play, Trash2, Disc, AlertTriangle, Plus, Edit2, X, Radio } from 'lucide-react';
import { TrackMetadata, PlaylistInfo, PlayerStatus } from '../types';
import { api } from '../api';

interface PlaylistViewProps {
  playlist: PlaylistInfo | null;
  playlists?: PlaylistInfo[];
  songs: TrackMetadata[];
  status: PlayerStatus | null;
  onSelectPlaylist?: (playlistId: number) => void;
  onCreatePlaylist?: (name: string) => Promise<void>;
  onRenamePlaylist?: (playlistId: number, name: string) => Promise<void>;
  onActivatePlaylist?: (playlistId: number) => Promise<void>;
  onClosePlaylist?: (playlistId: number) => Promise<void>;
  onRefresh?: () => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  playlists = [],
  songs,
  status,
  onSelectPlaylist,
  onCreatePlaylist,
  onRenamePlaylist,
  onActivatePlaylist,
  onClosePlaylist,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const currentTrackIndex = status?.current_track?.index;
  const isPlaying = status?.state === 'Playing';

  const hasMultiplePlaylists = playlists && playlists.length > 1;
  const targetPlId = playlist?.id ?? 1;

  const handlePlaySong = async (index: number) => {
    await api.changeSong(targetPlId, index);
  };

  const handleRemoveSong = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    setIsCreating(true);
    try {
      if (onCreatePlaylist) {
        await onCreatePlaylist(newPlaylistName.trim());
      } else {
        await api.createPlaylist(newPlaylistName.trim());
      }
      setNewPlaylistName('');
      setShowCreateModal(false);
    } catch (err) {
      console.error("Failed to create playlist", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim() || !playlist) return;
    setIsRenaming(true);
    try {
      if (onRenamePlaylist) {
        await onRenamePlaylist(playlist.id, renameValue.trim());
      } else {
        await api.renamePlaylist(playlist.id, renameValue.trim());
      }
      setShowRenameModal(false);
    } catch (err) {
      console.error("Failed to rename playlist", err);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleActivate = async () => {
    if (!playlist) return;
    try {
      if (onActivatePlaylist) {
        await onActivatePlaylist(playlist.id);
      } else {
        await api.activatePlaylist(playlist.id);
      }
    } catch (err) {
      console.error("Failed to activate playlist", err);
    }
  };

  const handleClose = async () => {
    if (!playlist) return;
    setIsClosing(true);
    try {
      if (onClosePlaylist) {
        await onClosePlaylist(playlist.id);
      } else {
        await api.closePlaylist(playlist.id);
      }
      setShowCloseConfirm(false);
    } catch (err) {
      console.error("Failed to close playlist", err);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="max-w-md landscape:max-w-4xl mx-auto px-4 py-3 w-full">
      {/* Playlist Switcher Pills Bar */}
      {hasMultiplePlaylists && (
        <div className="mb-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
            {playlists.map((pl) => {
              const isSelected = pl.id === targetPlId;
              return (
                <button
                  key={pl.id}
                  onClick={() => onSelectPlaylist && onSelectPlaylist(pl.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition active:scale-95 border flex-shrink-0 ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-sm'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] text-neutral-400 hover:text-neutral-200 border-white/5'
                  }`}
                >
                  {pl.active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Active in Clementine" />
                  )}
                  <span className="truncate max-w-[140px]">{pl.name}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] font-mono text-neutral-400">
                    {pl.item_count}
                  </span>
                </button>
              );
            })}

            {/* Create New Playlist Button */}
            <button
              onClick={() => {
                setNewPlaylistName('');
                setShowCreateModal(true);
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 active:scale-95 transition whitespace-nowrap flex-shrink-0"
              title="Create New Playlist"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>
        </div>
      )}

      {/* Playlist Details & Management Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 pb-2 border-b border-white/5 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-base sm:text-lg font-bold text-white truncate flex items-center space-x-1.5">
              <span>{playlist?.name || 'Now Playing Queue'}</span>
            </h2>
            {playlist && (
              <button
                onClick={() => {
                  setRenameValue(playlist.name);
                  setShowRenameModal(true);
                }}
                className="p-1 rounded-md text-neutral-500 hover:text-amber-400 hover:bg-white/5 transition flex-shrink-0"
                title="Rename Playlist"
                aria-label="Rename Playlist"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 mt-0.5">
            <p className="text-xs text-neutral-400">
              {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
            </p>

            {playlist?.active ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                <span>Playing</span>
              </span>
            ) : playlist ? (
              <button
                onClick={handleActivate}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 active:scale-95 transition"
                title="Set as active playlist in Clementine"
              >
                <span>Make Active</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 flex-shrink-0 self-start sm:self-auto">
          {!hasMultiplePlaylists && (
            <button
              onClick={() => {
                setNewPlaylistName('');
                setShowCreateModal(true);
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 active:scale-95 transition"
              title="Create New Playlist"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Playlist</span>
            </button>
          )}

          {songs.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 active:scale-95 transition"
              title="Clear Queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Queue</span>
            </button>
          )}

          {hasMultiplePlaylists && (
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-white/5 active:scale-95 transition"
              title="Close Playlist Tab"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
            const isCurrent = playlist?.active && currentTrackIndex === song.index;
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

      {/* Modal: Create New Playlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-hifi-800 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Create New Playlist</h3>
              <p className="text-xs text-neutral-400">
                A new playlist tab will be created in Clementine.
              </p>
            </div>

            <input
              type="text"
              placeholder="e.g. Chill Beats, Favorites"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              autoFocus
              required
            />

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold transition"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                disabled={isCreating || !newPlaylistName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Rename Playlist */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRenameSubmit}
            className="bg-hifi-800 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Rename Playlist</h3>
              <p className="text-xs text-neutral-400">
                Change the name of this playlist tab in Clementine.
              </p>
            </div>

            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              autoFocus
              required
            />

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold transition"
                disabled={isRenaming}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                disabled={isRenaming || !renameValue.trim()}
              >
                {isRenaming ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Close Playlist Confirm */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-hifi-800 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-neutral-700/50 border border-white/10 text-neutral-300 mx-auto flex items-center justify-center">
              <X className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Close Playlist Tab?</h3>
              <p className="text-xs text-neutral-400">
                Are you sure you want to close '{playlist?.name}'? The tracks can be reopened in Clementine.
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold transition"
                disabled={isClosing}
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
                disabled={isClosing}
              >
                {isClosing ? 'Closing...' : 'Close Tab'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmation for Clear Playlist */}
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
