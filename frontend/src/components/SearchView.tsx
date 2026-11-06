import React, { useState, useEffect } from 'react';
import { Search, X, Plus, User, Disc, Music } from 'lucide-react';
import { SearchResults, TrackMetadata } from '../types';
import { api } from '../api';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query);
        setResults(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handlePlayTrack = async (track: TrackMetadata) => {
    if (!track.url) return;
    await api.insertUrls(1, [track.url], true, false);
  };

  const handleEnqueueTrack = async (e: React.MouseEvent, track: TrackMetadata) => {
    e.stopPropagation();
    if (!track.url) return;
    await api.insertUrls(1, [track.url], false, true);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 min-h-[calc(100vh-8rem)] pb-24">
      {/* Search Input Bar */}
      <div className="relative mb-5">
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
                    className="flex items-center space-x-3 p-2 rounded-xl bg-white/[0.02] border border-white/5"
                  >
                    <div className="w-8 h-8 rounded-full bg-hifi-800 flex items-center justify-center">
                      <User className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-semibold text-white truncate">{artist.name}</span>
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
                {results.albums.map((album) => (
                  <div
                    key={`${album.artist}-${album.name}`}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center space-x-2.5"
                  >
                    <Disc className="w-7 h-7 text-neutral-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{album.name}</p>
                      <p className="text-[10px] text-amber-500 truncate">{album.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Songs */}
          {results.tracks.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-400 mb-2">Songs ({results.tracks.length})</h3>
              <div className="space-y-1">
                {results.tracks.map((trk, i) => (
                  <div
                    key={trk.url || i}
                    onClick={() => handlePlayTrack(trk)}
                    className="group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition text-neutral-200"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-sm font-medium truncate text-white">{trk.title}</p>
                      <p className="text-xs text-neutral-400 truncate">
                        {trk.artist} • {trk.album}
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
            </div>
          )}

          {results.artists.length === 0 && results.albums.length === 0 && results.tracks.length === 0 && (
            <div className="text-center py-16 text-neutral-500 text-xs">
              No results found for "{query}"
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 text-neutral-500">
          <Music className="w-10 h-10 stroke-1 mx-auto mb-2 opacity-40" />
          <p className="text-xs uppercase tracking-wider">Type above to search your music</p>
        </div>
      )}
    </div>
  );
};
