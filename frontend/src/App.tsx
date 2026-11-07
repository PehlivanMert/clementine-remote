import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { TabBar, TabType } from './components/TabBar';
import { NowPlaying } from './components/NowPlaying';
import { PlaylistView } from './components/PlaylistView';
import { LibraryView } from './components/LibraryView';
import { SearchView } from './components/SearchView';
import { SystemView } from './components/SystemView';
import { LoginModal } from './components/LoginModal';
import { PlayerStatus, PlaylistInfo, TrackMetadata } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './api';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('clementine_token'));
  const [currentTab, setCurrentTab] = useState<TabType>('player');
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [songs, setSongs] = useState<TrackMetadata[]>([]);

  const selectedPlaylistIdRef = React.useRef<number | null>(selectedPlaylistId);
  selectedPlaylistIdRef.current = selectedPlaylistId;

  const playlistsRef = React.useRef<PlaylistInfo[]>(playlists);
  playlistsRef.current = playlists;

  const songsRef = React.useRef<TrackMetadata[]>(songs);
  songsRef.current = songs;

  // Initial Auth Check
  useEffect(() => {
    api.checkAuth()
      .then((data) => {
        setIsAuthenticated(data.authenticated);
        if (data.authenticated) {
          fetchInitialState();
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });

    const handleAuthReq = () => setIsAuthenticated(false);
    window.addEventListener('auth_required', handleAuthReq);
    return () => window.removeEventListener('auth_required', handleAuthReq);
  }, []);

  const fetchInitialState = async () => {
    try {
      const s = await api.getStatus();
      setStatus(s);
      const pls = await api.getPlaylists();
      setPlaylists(pls);
      const activePl = pls.find((p) => p.active) || pls[0];
      if (activePl) {
        setSelectedPlaylistId((prev) => prev ?? activePl.id);
        const sngs = await api.getPlaylistSongs(activePl.id);
        setSongs(sngs);
      }
    } catch (e) {
      console.error('Initial state fetch error:', e);
    }
  };

  // WebSocket Event Handler
  const handleWsEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case 'initial_state':
        if (data.status) setStatus(data.status);
        if (data.playlists) setPlaylists(data.playlists);
        if (data.active_playlist_id) {
          setSelectedPlaylistId((prev) => prev ?? data.active_playlist_id);
        }
        if (data.active_songs) setSongs(data.active_songs);
        break;

      case 'state_changed':
        setStatus((prev) => (prev ? { ...prev, state: data } : null));
        break;

      case 'track_changed':
        setStatus((prev) => (prev ? { ...prev, current_track: data, duration: data.length } : null));
        break;

      case 'position_changed':
        setStatus((prev) => (prev ? { ...prev, position: data } : null));
        break;

      case 'volume_changed':
        setStatus((prev) => (prev ? { ...prev, volume: data } : null));
        break;

      case 'repeat_changed':
        setStatus((prev) => (prev ? { ...prev, repeat_mode: data } : null));
        break;

      case 'shuffle_changed':
        setStatus((prev) => (prev ? { ...prev, shuffle_mode: data } : null));
        break;

      case 'clementine_connection_changed':
        setStatus((prev) => (prev ? { ...prev, clementine_connected: data } : null));
        break;

      case 'active_playlist_changed':
        setPlaylists((prev) =>
          prev.map((p) => ({ ...p, active: p.id === data }))
        );
        break;

      case 'playlist_songs_updated':
        if (data && Array.isArray(data.songs)) {
          const active = playlistsRef.current.find((p) => p.active) || playlistsRef.current[0];
          const viewedId = selectedPlaylistIdRef.current ?? active?.id ?? 1;
          if (data.playlist_id === viewedId) {
            setSongs(data.songs);
          }
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === data.playlist_id ? { ...p, item_count: data.songs.length } : p
            )
          );
        }
        break;

      case 'playlists_updated':
        if (Array.isArray(data)) {
          setPlaylists(data);
          const active = data.find((p) => p.active) || data[0];
          const currentSelected = selectedPlaylistIdRef.current;
          const nextSelected = currentSelected && data.some((p) => p.id === currentSelected)
            ? currentSelected
            : (active ? active.id : null);

          if (nextSelected !== currentSelected) {
            setSelectedPlaylistId(nextSelected);
          }

          const viewed = data.find((p) => p.id === nextSelected);
          if (viewed && songsRef.current.length !== viewed.item_count) {
            api.getPlaylistSongs(viewed.id, true)
              .then((fresh) => {
                const nowViewed = selectedPlaylistIdRef.current ?? (data.find((p) => p.active) || data[0])?.id;
                if (nowViewed === viewed.id) {
                  setSongs(fresh);
                }
              })
              .catch(() => {});
          }
        }
        break;

      default:
        break;
    }
  }, []);

  const { isConnected: wsConnected } = useWebSocket(handleWsEvent);

  const activePlaylist = playlists.find((p) => p.active) || playlists[0] || null;
  const currentViewedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || activePlaylist;

  const handleSelectPlaylist = async (id: number) => {
    setSelectedPlaylistId(id);
    try {
      const sngs = await api.getPlaylistSongs(id);
      setSongs(sngs);
    } catch (e) {
      console.error('Failed to load playlist songs', e);
    }
  };

  const handleCreatePlaylist = async (name: string) => {
    await api.createPlaylist(name);
    try {
      const pls = await api.getPlaylists();
      setPlaylists(pls);
      const created = pls.find((p) => p.name === name);
      if (created) {
        await handleSelectPlaylist(created.id);
      }
    } catch (e) {
      console.error('Failed to refresh after create', e);
    }
  };

  const handleRenamePlaylist = async (id: number, name: string) => {
    await api.renamePlaylist(id, name);
    try {
      const pls = await api.getPlaylists();
      setPlaylists(pls);
    } catch (e) {
      console.error('Failed to refresh after rename', e);
    }
  };

  const handleActivatePlaylist = async (id: number) => {
    await api.activatePlaylist(id);
    setPlaylists((prev) =>
      prev.map((p) => ({ ...p, active: p.id === id }))
    );
  };

  const handleClosePlaylist = async (id: number) => {
    await api.closePlaylist(id);
    try {
      const pls = await api.getPlaylists();
      setPlaylists(pls);
      if (selectedPlaylistId === id) {
        const next = pls.find((p) => p.active) || pls[0];
        if (next) {
          await handleSelectPlaylist(next.id);
        } else {
          setSelectedPlaylistId(null);
          setSongs([]);
        }
      }
    } catch (e) {
      console.error('Failed to refresh after close', e);
    }
  };

  const handleRemoveSong = async (playlistId: number, index: number) => {
    // 1. Optimistic local removal
    setSongs((prev) => {
      const next = prev.filter((s, i) => (s.index !== undefined ? s.index !== index : i !== index));
      return next.map((s, idx) => ({ ...s, index: idx }));
    });
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId ? { ...p, item_count: Math.max(0, p.item_count - 1) } : p
      )
    );

    // 2. Call backend
    try {
      await api.removeSongs(playlistId, [index]);
    } catch (e) {
      console.error('Failed to remove song:', e);
      const [freshSongs, freshPlaylists] = await Promise.all([
        api.getPlaylistSongs(playlistId, true),
        api.getPlaylists(),
      ]);
      setSongs(freshSongs);
      setPlaylists(freshPlaylists);
    }
  };

  const handleClearPlaylist = async (playlistId: number) => {
    setSongs([]);
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, item_count: 0 } : p))
    );
    try {
      await api.clearPlaylist(playlistId);
    } catch (e) {
      console.error('Failed to clear playlist:', e);
      const [freshSongs, freshPlaylists] = await Promise.all([
        api.getPlaylistSongs(playlistId, true),
        api.getPlaylists(),
      ]);
      setSongs(freshSongs);
      setPlaylists(freshPlaylists);
    }
  };

  const handleRefreshPlaylist = async () => {
    const targetId = selectedPlaylistId || activePlaylist?.id || 1;
    try {
      const [freshSongs, freshPlaylists] = await Promise.all([
        api.getPlaylistSongs(targetId, true),
        api.getPlaylists(),
      ]);
      setSongs(freshSongs);
      setPlaylists(freshPlaylists);
    } catch (e) {
      console.error('Failed to refresh playlist:', e);
    }
  };

  return (
    <div className="h-screen h-[100dvh] bg-hifi-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Navigation */}
      <Navbar
        status={status}
        wsConnected={wsConnected}
        onOpenSystem={() => setCurrentTab('system')}
      />

      {/* Main Content Area */}
      <main className="flex-1 main-content-layout safe-x flex flex-col min-h-0 overflow-y-auto">
        {currentTab === 'player' && (
          <NowPlaying status={status} />
        )}
        {currentTab === 'queue' && (
          <PlaylistView
            playlist={currentViewedPlaylist}
            playlists={playlists}
            songs={songs}
            status={status}
            onSelectPlaylist={handleSelectPlaylist}
            onCreatePlaylist={handleCreatePlaylist}
            onRenamePlaylist={handleRenamePlaylist}
            onActivatePlaylist={handleActivatePlaylist}
            onClosePlaylist={handleClosePlaylist}
            onRemoveSong={handleRemoveSong}
            onClearPlaylist={handleClearPlaylist}
            onRefresh={handleRefreshPlaylist}
          />
        )}
        {currentTab === 'library' && (
          <LibraryView
            activePlaylistId={currentViewedPlaylist?.id || activePlaylist?.id}
            playlists={playlists}
          />
        )}
        {currentTab === 'search' && (
          <SearchView
            activePlaylistId={currentViewedPlaylist?.id || activePlaylist?.id}
            playlists={playlists}
          />
        )}
        {currentTab === 'system' && (
          <SystemView
            onLogout={async () => {
              await api.logout();
              setIsAuthenticated(false);
            }}
          />
        )}
      </main>

      {/* Bottom Tab Bar */}
      <TabBar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        queueCount={songs.length}
      />

      {/* Authentication Modal */}
      {!isAuthenticated && (
        <LoginModal
          onSuccess={() => {
            setIsAuthenticated(true);
            fetchInitialState();
          }}
        />
      )}
    </div>
  );
};

export default App;
