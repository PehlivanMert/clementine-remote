import React, { useState, useEffect } from 'react';
import { Search, X, Plus, User, Disc, Music } from 'lucide-react';
import { SearchResults, TrackMetadata, PlaylistInfo } from '../types';
import { api, getApiUrl } from '../api';

interface SearchViewProps {
  activePlaylistId?: number;
  playlists?: PlaylistInfo[];
}

const FORMAT_OPTIONS = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'FLAC', label: 'FLAC' },
  { id: 'MP3', label: 'MP3' },
  { id: 'HIRES', label: 'Hi-Res' },
];

export const SearchView: React.FC<SearchViewProps> = ({ activePlaylistId = 1, playlists = [] }) => {
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [targetPlId, setTargetPlId] = useState<number>(activePlaylistId);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTargetPlId(activePlaylistId);
  }, [activePlaylistId]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const fmt = formatFilter === 'ALL' ? undefined : formatFilter;
        const data = await api.search(query, fmt);
        setResults(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(timer);
  }, [query, formatFilter]);

  const handlePlayTrack = async (track: TrackMetadata) => {
    if (!track.url) return;
    await api.insertUrls(targetPlId, [track.url], true, false);
  };

  const handleEnqueueTrack = async (e: React.MouseEvent, track: TrackMetadata) => {
    e.stopPropagation();
    if (!track.url) return;
    await api.insertUrls(targetPlId, [track.url], false, true);
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

  return (
    <div className="max-w-md landscape:max-w-3xl mx-auto px-4 py-4 w-full pb-10">
      {/* Target Playlist Selector Bar if multiple playlists */}
      {playlists.length > 1 && (
        <div className="flex items-center justify-between mb-3 px-1 text-xs text-neutral-400">
          <span>Add tracks to:</span>
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

      {/* Search Input Bar */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, albums..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Format Filter Pills (FLAC / MP3 / Hi-Res / All) */}
      <div className="flex items-center space-x-1.5 mb-5 overflow-x-auto no-scrollbar py-0.5">
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
        <div className="text-center py-16 text-xs text-neutral-400">Searching library...</div>
      ) : results ? (
        <div className="space-y-6">
          {/* Artists */}
          {results.artists.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-400 mb-2">Artists</h3>
              <div className="space-y-1">
                {results.artists.map((artist) => (
                  <div
                    key={artist.name}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden pr-2">
                      <div className="w-8 h-8 rounded-full bg-hifi-800 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-amber-500" />
                      </div>
                      <span className="text-sm font-semibold text-white truncate">{artist.name}</span>
                    </div>
                    {artist.formats && artist.formats.length > 0 && (
                      <div className="flex items-center space-x-1 flex-shrink-0">
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Albums */}
          {results.albums.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-400 mb-2">Albums</h3>
              <div className="grid grid-cols-2 gap-2">
                {results.albums.map((album) => {
                  const coverSrc = album.sample_track_url
                    ? getApiUrl(`/api/artwork/file?path=${encodeURIComponent(album.sample_track_url)}&thumb=true`)
                    : null;

                  return (
                    <div
                      key={`${album.artist}-${album.name}`}
                      className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center space-x-2.5 relative"
                    >
                      <div className="w-9 h-9 rounded-lg bg-hifi-800 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                        {coverSrc ? (
                          <img
                            src={coverSrc}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Disc className="w-5 h-5 text-neutral-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{album.name}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{album.artist}</p>
                        {album.formats && album.formats.length > 0 && (
                          <div className="flex items-center space-x-1 mt-0.5">
                            {album.formats.map((f) => (
                              <span
                                key={f}
                                className={`px-1 py-0.2 rounded text-[7px] font-mono font-semibold ${
                                  f === 'FLAC'
                                    ? 'text-cyan-300'
                                    : 'text-neutral-400'
                                }`}
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tracks */}
          {results.tracks.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-400 mb-2">Songs</h3>
              <div className="space-y-1">
                {results.tracks.map((track) => {
                  const artSrc = (track.filename || track.url)
                    ? getApiUrl(`/api/artwork/file?path=${encodeURIComponent(track.url || track.filename || '')}&thumb=true`)
                    : null;

                  return (
                    <div
                      key={track.url || track.id}
                      onClick={() => handlePlayTrack(track)}
                      className="group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition text-neutral-200"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                        <div className="w-9 h-9 rounded-lg bg-hifi-800 border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
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
                            <Music className="w-4 h-4 text-neutral-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate text-white">{track.title}</p>
                          <p className="text-xs text-neutral-400 truncate">
                            {track.artist} {track.album ? `• ${track.album}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {renderFormatBadge(track)}
                        <span className="text-xs font-mono text-neutral-400">{track.pretty_length}</span>
                        <button
                          onClick={(e) => handleEnqueueTrack(e, track)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition"
                          title="Add to queue"
                          aria-label={`Queue ${track.title}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {results.artists.length === 0 && results.albums.length === 0 && results.tracks.length === 0 && (
            <div className="text-center py-16 text-xs text-neutral-500">
              No matching tracks, albums, or artists found for "{query}"
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 text-neutral-500 text-xs">
          Type to search your Clementine library
        </div>
      )}
    </div>
  );
};
