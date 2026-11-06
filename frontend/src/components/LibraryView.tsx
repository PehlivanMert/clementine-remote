import React, { useState, useEffect } from 'react';
import { User, Disc, Play, Plus, ChevronRight, ArrowLeft } from 'lucide-react';
import { ArtistItem, AlbumItem, TrackMetadata } from '../types';
import { api } from '../api';

interface LibraryViewProps {
  activePlaylistId?: number;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ activePlaylistId = 1 }) => {
  const [subTab, setSubTab] = useState<'artists' | 'albums' | 'tracks'>('albums');
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [tracks, setTracks] = useState<TrackMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  // Drilldown state
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumItem | null>(null);
  const [albumTracks, setAlbumTracks] = useState<TrackMetadata[]>([]);

  useEffect(() => {
    loadData();
  }, [subTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (subTab === 'artists') {
        const data = await api.getArtists();
        setArtists(data);
      } else if (subTab === 'albums') {
        const data = await api.getAlbums();
        setAlbums(data);
      } else if (subTab === 'tracks') {
        const data = await api.getTracks();
        setTracks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlbum = async (album: AlbumItem) => {
    setSelectedAlbum(album);
    try {
      const trks = await api.getTracks(album.artist, album.name);
      setAlbumTracks(trks);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlayTrack = async (track: TrackMetadata) => {
    if (!track.url) return;
    await api.insertUrls(activePlaylistId, [track.url], true, false);
  };

  const handleEnqueueTrack = async (e: React.MouseEvent, track: TrackMetadata) => {
    e.stopPropagation();
    if (!track.url) return;
    await api.insertUrls(activePlaylistId, [track.url], false, true);
  };

  const handlePlayAlbumAll = async () => {
    if (!albumTracks.length) return;
    const urls = albumTracks.map((t) => t.url).filter(Boolean) as string[];
    await api.insertUrls(activePlaylistId, urls, true, false);
  };

  const handleEnqueueAlbumAll = async () => {
    if (!albumTracks.length) return;
    const urls = albumTracks.map((t) => t.url).filter(Boolean) as string[];
    await api.insertUrls(activePlaylistId, urls, false, true);
  };

  // If viewing an album detail drilldown
  if (selectedAlbum) {
    const albumArtSrc = selectedAlbum.sample_track_url || albumTracks[0]?.url;

    return (
      <div className="max-w-md mx-auto px-4 py-4 min-h-[calc(100vh-8rem)] pb-24">
        <button
          onClick={() => setSelectedAlbum(null)}
          className="flex items-center space-x-1 text-sm text-neutral-400 hover:text-white mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Albums</span>
        </button>

        <div className="flex space-x-4 mb-6">
          <div className="w-24 h-24 rounded-xl bg-hifi-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-lg">
            {albumArtSrc ? (
              <img
                src={`/api/artwork/file?path=${encodeURIComponent(albumArtSrc)}&thumb=true`}
                alt={selectedAlbum.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/icons/clementine-icon.svg';
                }}
              />
            ) : (
              <Disc className="w-10 h-10 text-neutral-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{selectedAlbum.name}</h2>
            <p className="text-sm text-amber-500 font-medium truncate">{selectedAlbum.artist}</p>
            <p className="text-xs text-neutral-400 mt-1">
              {albumTracks.length} tracks {selectedAlbum.year ? `• ${selectedAlbum.year}` : ''}
            </p>

            <div className="flex space-x-2 mt-3">
              <button
                onClick={handlePlayAlbumAll}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold shadow-md shadow-amber-500/20 active:scale-95 transition"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Play All</span>
              </button>
              <button
                onClick={handleEnqueueAlbumAll}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Queue</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tracks in Album */}
        <div className="space-y-1">
          {albumTracks.map((trk, i) => (
            <div
              key={trk.url || i}
              onClick={() => handlePlayTrack(trk)}
              className="group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition text-neutral-200"
            >
              <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                <span className="w-5 text-xs font-mono text-neutral-500 text-center">
                  {trk.track || i + 1}
                </span>
                <span className="text-sm font-medium truncate">{trk.title}</span>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <span className="text-xs font-mono text-neutral-400">{trk.pretty_length}</span>
                <button
                  onClick={(e) => handleEnqueueTrack(e, trk)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition"
                  title="Add to queue"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 min-h-[calc(100vh-8rem)] pb-24">
      {/* Subtabs Bar */}
      <div className="flex rounded-xl bg-white/5 p-1 mb-5 border border-white/5">
        {(['albums', 'artists', 'tracks'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
              subTab === tab
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-neutral-400 text-xs">Loading library...</div>
      ) : subTab === 'albums' ? (
        <div className="grid grid-cols-2 gap-3">
          {albums.map((album) => {
            const coverSrc = album.sample_track_url
              ? `/api/artwork/file?path=${encodeURIComponent(album.sample_track_url)}&thumb=true`
              : null;

            return (
              <div
                key={`${album.artist}-${album.name}`}
                onClick={() => handleSelectAlbum(album)}
                className="group p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 hover:bg-white/[0.06] cursor-pointer transition flex flex-col"
              >
                <div className="w-full aspect-square rounded-xl bg-hifi-800 border border-white/10 overflow-hidden mb-2.5 flex items-center justify-center relative shadow-sm">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={album.name}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}

                  <Disc className="w-10 h-10 text-neutral-600 absolute" />

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Play className="w-8 h-8 text-amber-500 fill-amber-500" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-white truncate">{album.name}</h3>
                <p className="text-xs text-amber-500/90 truncate mt-0.5">{album.artist}</p>
                <p className="text-[10px] text-neutral-400 mt-1">{album.track_count} tracks</p>
              </div>
            );
          })}
        </div>
      ) : subTab === 'artists' ? (
        <div className="space-y-1.5">
          {artists.map((artist) => (
            <div
              key={artist.name}
              onClick={async () => {
                const albList = await api.getAlbums(artist.name);
                if (albList.length > 0) {
                  handleSelectAlbum(albList[0]);
                }
              }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition text-neutral-200"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-hifi-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate text-white">{artist.name}</p>
                  <p className="text-xs text-neutral-400">
                    {artist.album_count} albums • {artist.track_count} songs
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {tracks.map((trk, i) => (
            <div
              key={trk.url || i}
              onClick={() => handlePlayTrack(trk)}
              className="group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition text-neutral-200"
            >
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-sm font-medium truncate text-white">{trk.title}</p>
                <p className="text-xs text-neutral-400 truncate">
                  {trk.artist} {trk.album ? `• ${trk.album}` : ''}
                </p>
              </div>
              <div className="flex items-center space-x-3 flex-shrink-0">
                <span className="text-xs font-mono text-neutral-400">{trk.pretty_length}</span>
                <button
                  onClick={(e) => handleEnqueueTrack(e, trk)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition"
                  title="Add to queue"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
