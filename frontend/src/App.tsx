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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<TabType>('player');
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [songs, setSongs] = useState<TrackMetadata[]>([]);

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

      case 'playlist_songs_updated':
        if (data.songs) setSongs(data.songs);
        break;

      case 'playlists_updated':
        if (Array.isArray(data)) setPlaylists(data);
        break;

      default:
        break;
    }
  }, []);

  const { isConnected: wsConnected } = useWebSocket(handleWsEvent);

  const activePlaylist = playlists.find((p) => p.active) || playlists[0] || null;

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
            playlist={activePlaylist}
            songs={songs}
            status={status}
          />
        )}
        {currentTab === 'library' && (
          <LibraryView activePlaylistId={activePlaylist?.id} />
        )}
        {currentTab === 'search' && (
          <SearchView activePlaylistId={activePlaylist?.id} />
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
