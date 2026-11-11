import {
  PlayerStatus,
  PlaylistInfo,
  TrackMetadata,
  ArtistItem,
  AlbumItem,
  SearchResults,
  SystemInfo,
  LyricsResponse,
  SleepTimerStatus,
} from './types';

const getHeaders = () => {
  const token = localStorage.getItem('clementine_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res: Response) => {
  if (res.status === 401) {
    localStorage.removeItem('clementine_token');
    window.dispatchEvent(new Event('auth_required'));
    throw new Error('Authentication required');
  }
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP error ${res.status}`);
  }
  return res.json();
};

export const api = {
  // Auth
  login: async (password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await handleResponse(res);
    if (data.token) {
      localStorage.setItem('clementine_token', data.token);
    }
    return data;
  },

  checkAuth: async () => {
    const res = await fetch('/api/auth/status', {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  logout: async () => {
    localStorage.removeItem('clementine_token');
    await fetch('/api/auth/logout', { method: 'POST' });
  },

  // Player
  getStatus: async (): Promise<PlayerStatus> => {
    const res = await fetch('/api/player/status', { headers: getHeaders() });
    return handleResponse(res);
  },

  play: async () => {
    const res = await fetch('/api/player/play', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  pause: async () => {
    const res = await fetch('/api/player/pause', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  playPause: async () => {
    const res = await fetch('/api/player/play_pause', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  stop: async () => {
    const res = await fetch('/api/player/stop', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  next: async () => {
    const res = await fetch('/api/player/next', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  previous: async () => {
    const res = await fetch('/api/player/previous', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  setVolume: async (volume: number) => {
    const res = await fetch('/api/player/volume', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ volume }),
    });
    return handleResponse(res);
  },

  seek: async (position: number) => {
    const res = await fetch('/api/player/seek', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ position }),
    });
    return handleResponse(res);
  },

  getLyrics: async (artist?: string, title?: string, album?: string, duration?: number): Promise<LyricsResponse> => {
    let url = '/api/player/lyrics?';
    if (artist) url += `artist=${encodeURIComponent(artist)}&`;
    if (title) url += `title=${encodeURIComponent(title)}&`;
    if (album) url += `album=${encodeURIComponent(album)}&`;
    if (duration) url += `duration=${encodeURIComponent(duration)}&`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  getSleepTimer: async (): Promise<SleepTimerStatus> => {
    const res = await fetch('/api/player/sleep-timer', { headers: getHeaders() });
    return handleResponse(res);
  },

  startSleepTimer: async (params: { duration_minutes?: number; duration_seconds?: number; end_of_track?: boolean }): Promise<SleepTimerStatus> => {
    const res = await fetch('/api/player/sleep-timer', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    return handleResponse(res);
  },

  cancelSleepTimer: async (): Promise<SleepTimerStatus> => {
    const res = await fetch('/api/player/sleep-timer', {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  setShuffle: async (mode: number) => {
    const res = await fetch('/api/player/shuffle', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ mode }),
    });
    return handleResponse(res);
  },

  setRepeat: async (mode: number) => {
    const res = await fetch('/api/player/repeat', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ mode }),
    });
    return handleResponse(res);
  },

  // Playlist
  getPlaylists: async (): Promise<PlaylistInfo[]> => {
    const res = await fetch('/api/playlist/', { headers: getHeaders() });
    return handleResponse(res);
  },

  getPlaylistSongs: async (playlistId: number, refresh: boolean = false): Promise<TrackMetadata[]> => {
    const url = `/api/playlist/${playlistId}/songs${refresh ? '?refresh=true' : ''}`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  changeSong: async (playlistId: number, songIndex: number) => {
    const res = await fetch('/api/playlist/change_song', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId, song_index: songIndex }),
    });
    return handleResponse(res);
  },

  insertUrls: async (playlistId: number, urls: string[], playNow = false, enqueue = false) => {
    const res = await fetch('/api/playlist/insert', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        playlist_id: playlistId,
        urls,
        play_now: playNow,
        enqueue,
      }),
    });
    return handleResponse(res);
  },

  removeSongs: async (playlistId: number, songIndices: number[]) => {
    const res = await fetch('/api/playlist/remove', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId, song_indices: songIndices }),
    });
    return handleResponse(res);
  },

  clearPlaylist: async (playlistId?: number) => {
    const res = await fetch('/api/playlist/clear', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId }),
    });
    return handleResponse(res);
  },

  createPlaylist: async (name: string) => {
    const res = await fetch('/api/playlist/create', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res);
  },

  renamePlaylist: async (playlistId: number, name: string) => {
    const res = await fetch('/api/playlist/rename', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId, name }),
    });
    return handleResponse(res);
  },

  activatePlaylist: async (playlistId: number) => {
    const res = await fetch(`/api/playlist/${playlistId}/activate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  closePlaylist: async (playlistId: number) => {
    const res = await fetch(`/api/playlist/${playlistId}/close`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Library
  getArtists: async (format?: string): Promise<ArtistItem[]> => {
    const url = format ? `/api/library/artists?format=${encodeURIComponent(format)}` : '/api/library/artists';
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  getAlbums: async (artist?: string, format?: string): Promise<AlbumItem[]> => {
    let url = '/api/library/albums?';
    if (artist) url += `artist=${encodeURIComponent(artist)}&`;
    if (format) url += `format=${encodeURIComponent(format)}&`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  getTracks: async (artist?: string, album?: string, format?: string): Promise<TrackMetadata[]> => {
    let url = '/api/library/tracks?';
    if (artist) url += `artist=${encodeURIComponent(artist)}&`;
    if (album) url += `album=${encodeURIComponent(album)}&`;
    if (format) url += `format=${encodeURIComponent(format)}&`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  search: async (query: string, format?: string): Promise<SearchResults> => {
    let url = `/api/library/search?q=${encodeURIComponent(query)}`;
    if (format) url += `&format=${encodeURIComponent(format)}`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  // System
  getSystemInfo: async (): Promise<SystemInfo> => {
    const res = await fetch('/api/system/info');
    return handleResponse(res);
  },
};
