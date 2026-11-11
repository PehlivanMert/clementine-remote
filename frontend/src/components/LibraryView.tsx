import React, { useState, useEffect } from 'react';
import { User, Disc, Play, Plus, ChevronRight, ArrowLeft } from 'lucide-react';
import { ArtistItem, AlbumItem, TrackMetadata, PlaylistInfo } from '../types';
import { api } from '../api';

interface LibraryViewProps {
  activePlaylistId?: number;
  playlists?: PlaylistInfo[];
}

const FORMAT_OPTIONS = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'FLAC', label: 'FLAC' },
  { id: 'MP3', label: 'MP3' },
  { id: 'HIRES', label: 'Hi-Res' },
];

export const LibraryView: React.FC<LibraryViewProps> = ({ activePlaylistId = 1, playlists = [] }) => {
  const [subTab, setSubTab] = useState<'albums' | 'artists' | 'tracks'>('albums');
  const [formatFilter, setFormatFilter] = useState<string>('ALL');
  const [targetPlId, setTargetPlId] = useState<number>(activePlaylistId);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [tracks, setTracks] = useState<TrackMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTargetPlId(activePlaylistId);
  }, [activePlaylistId]);

  // Drilldown state
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumItem | null>(null);
  const [albumTracks, setAlbumTracks] = useState<TrackMetadata[]>([]);

  useEffect(() => {
    loadData();
  }, [subTab, formatFilter]);

  const loadData = async () => {
    setLoading(true);
    const fmt = formatFilter === 'ALL' ? undefined : formatFilter;
    try {
      if (subTab === 'artists') {
        const data = await api.getArtists(fmt);
        setArtists(data);
      } else if (subTab === 'albums') {
        const data = await api.getAlbums(undefined, fmt);
        setAlbums(data);
      } else if (subTab === 'tracks') {
        const data = await api.getTracks(undefined, undefined, fmt);
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
    await api.insertUrls(targetPlId, [track.url], true, false);
  };

  const handleEnqueueTrack = async (e: React.MouseEvent, track: TrackMetadata) => {
    e.stopPropagation();
    if (!track.url) return;
    await api.insertUrls(targetPlId, [track.url], false, true);
  };

  const handlePlayAlbumAll = async () => {
    if (!albumTracks.length) return;
    const urls = albumTracks.map((t) => t.url).filter(Boolean) as string[];
    await api.insertUrls(targetPlId, urls, true, false);
  };

  const handleEnqueueAlbumAll = async () => {
    if (!albumTracks.length) return;
    const urls = albumTracks.map((t) => t.url).filter(Boolean) as string[];
    await api.insertUrls(targetPlId, urls, false, true);
  };

  const renderFormatBadge = (track: TrackMetadata) => {
    const fmt = track.audio_format?.toUpperCase();
    if (!fmt) return null;

    if (track.is_hi_res) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          HI-RES
        </span>
      );
    }
    if (fmt === 'FLAC') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          FLAC
        </span>
      );
    }
    if (fmt === 'MP3') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/10 text-neutral-400 border border-white/10">
          MP3
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 text-neutral-400 border border-white/10">
        {fmt}
      </span>
    );
  };

  // If viewing an album detail drilldown
  if (selectedAlbum) {
    const albumArtSrc = selectedAlbum.sample_track_url || albumTracks[0]?.url;

    return (
      <div className="max-w-md landscape:max-w-4xl mx-auto px-4 py-4 w-full pb-10">
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
                src={`/api/artwork/file?path=${encodeURIComponent(albumArtSrc)}`}
                alt={selectedAlbum.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            <Disc className="w-10 h-10 text-neutral-600 absolute" />
          </div>

          <div className="flex flex-col justify-center min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white truncate">{selectedAlbum.name}</h2>
            <p className="text-sm font-medium text-amber-500/90 truncate">{selectedAlbum.artist}</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs text-neutral-400">{albumTracks.length} tracks</span>
              {selectedAlbum.formats && selectedAlbum.formats.length > 0 && (
                <div className="flex items-center space-x-1">
                  {selectedAlbum.formats.map((f) => (
                    <span
                      key={f}
                      className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-semibold ${
                        f === 'FLAC'
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/5 text-neutral-400 border border-white/10'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 mt-3">
              <button
                onClick={handlePlayAlbumAll}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-semibold shadow-md active:scale-95 transition"
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
              {playlists.length > 1 && (
                <div className="flex items-center space-x-1 text-xs text-neutral-400">
                  <span className="text-[11px]">To:</span>
                  <select
                    value={targetPlId}
                    onChange={(e) => setTargetPlId(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-lg text-xs text-amber-300 py-1 px-2 focus:outline-none focus:border-amber-500/50"
                  >
                    {playlists.map((pl) => (
                      <option key={pl.id} value={pl.id} className="bg-hifi-800 text-white">
                        {pl.name} {pl.active ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
              <div className="flex items-center space-x-2.5 flex-shrink-0">
                {renderFormatBadge(trk)}
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
    <div className="max-w-md landscape:max-w-4xl mx-auto px-4 py-4 w-full pb-10">
      {/* Subtabs Bar */}
      <div className="flex max-w-sm landscape:max-w-md mx-auto rounded-xl bg-white/5 p-1 mb-3 border border-white/5">
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

      {/* Format Filter Bar (FLAC / MP3 / Hi-Res / All) */}
      <div className="flex items-center justify-center space-x-1.5 mb-5 overflow-x-auto no-scrollbar py-0.5">
        {FORMAT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFormatFilter(opt.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer select-none whitespace-nowrap active:scale-95 ${
              formatFilter === opt.id
                ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/20'
                : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-neutral-400 text-xs">Loading library...</div>
      ) : subTab === 'albums' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 landscape:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {albums.map((album) => {
            const coverSrc = album.sample_track_url
              ? `/api/artwork/file?path=${encodeURIComponent(album.sample_track_url)}&thumb=true`
              : null;

            return (
              <div
                key={`${album.artist}-${album.name}`}
                onClick={() => handleSelectAlbum(album)}
                className="group p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 hover:bg-white/[0.06] cursor-pointer transition flex flex-col relative"
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white truncate flex-1">{album.name}</h3>
                  {album.formats && album.formats.length > 0 && (
                    <span
                      className={`ml-1 px-1 py-0.2 rounded text-[8px] font-mono font-bold flex-shrink-0 ${
                        album.formats.includes('FLAC')
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/5 text-neutral-400 border border-white/10'
                      }`}
                    >
                      {album.formats.includes('FLAC') ? 'FLAC' : album.formats[0]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-500/90 truncate mt-0.5">{album.artist}</p>
                <p className="text-[10px] text-neutral-400 mt-1">{album.track_count} tracks</p>
              </div>
            );
          })}
        </div>
      ) : subTab === 'artists' ? (
        <div className="grid grid-cols-1 landscape:grid-cols-2 gap-2">
          {artists.map((artist) => (
            <div
              key={artist.name}
              onClick={async () => {
                const fmt = formatFilter === 'ALL' ? undefined : formatFilter;
                const albList = await api.getAlbums(artist.name, fmt);
                if (albList.length > 0) {
                  handleSelectAlbum(albList[0]);
                }
              }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition text-neutral-200"
            >
              <div className="flex items-center space-x-3 min-w-0 pr-2">
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
              <div className="flex items-center space-x-2 flex-shrink-0">
                {artist.formats && artist.formats.length > 0 && (
                  <div className="flex items-center space-x-1">
                    {artist.formats.map((f) => (
                      <span
                        key={f}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold ${
                          f === 'FLAC'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-white/5 text-neutral-400 border border-white/10'
                        }`}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </div>
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
              <div className="flex items-center space-x-2.5 flex-shrink-0">
                {renderFormatBadge(trk)}
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
