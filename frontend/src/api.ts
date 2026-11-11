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

const NTFY_API_URL = "https://ntfy.sh/clementine_remote_mert_tunnel_450d9/json?poll=1";
const GIST_API_URL = "https://api.github.com/gists/450d94b168498b7b178cd9f1ce667344";

let activeServerUrl = localStorage.getItem('clementine_server_url') || '';
let lastTunnelPoll = 0;

export async function resolveServerUrl(force = false): Promise<string> {
  const host = window.location.host;
  // If running directly on local server or direct trycloudflare tunnel domain, relative paths work directly
  if (!host.includes('github.io') && !window.location.protocol.startsWith('file')) {
    activeServerUrl = '';
    return '';
  }

  const now = Date.now();
  if (!force && activeServerUrl && (now - lastTunnelPoll < 5000)) {
    return activeServerUrl;
  }
  lastTunnelPoll = now;

  // 1. If we have a stored URL, do a quick health check
  if (activeServerUrl) {
    try {
      const ping = await fetch(`${activeServerUrl}/api/system/info`, { signal: AbortSignal.timeout(1200) });
      if (ping.ok) {
        return activeServerUrl;
      }
    } catch {
      // Stored URL not responding, continue to resolve fresh tunnel
    }
  }

  // 2. Poll ntfy.sh instant bridge
  try {
    const resp = await fetch(`${NTFY_API_URL}&_t=${now}`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (resp.ok) {
      const text = await resp.text();
      const lines = text.trim().split("\n").filter(l => l.trim().length > 0);
      const messages = lines
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(m => m && m.event === "message" && m.message);
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        const msg = (lastMsg.message || "").trim();
        if (msg.startsWith("https://") && msg.includes("trycloudflare.com")) {
          activeServerUrl = msg.replace(/\/+$/, '');
          localStorage.setItem('clementine_server_url', activeServerUrl);
          return activeServerUrl;
        } else if (msg === "OFFLINE") {
          activeServerUrl = '';
          localStorage.removeItem('clementine_server_url');
        }
      }
    }
  } catch {
    // ntfy error, fallback to Gist
  }

  // 3. Fallback to Gist
  try {
    const resp = await fetch(`${GIST_API_URL}?_t=${now}`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (resp.ok) {
      const data = await resp.json();
      const file = data.files && data.files["clementine_tunnel.json"];
      if (file && file.content) {
        const parsed = JSON.parse(file.content);
        if (parsed && parsed.tunnel && parsed.tunnel.startsWith("https://")) {
          activeServerUrl = parsed.tunnel.trim().replace(/\/+$/, '');
          localStorage.setItem('clementine_server_url', activeServerUrl);
          return activeServerUrl;
        }
      }
    }
  } catch {
    // Offline
  }

  return activeServerUrl || '';
}

export const getApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const prefix = activeServerUrl ? activeServerUrl.replace(/\/+$/, '') : '';
  const cleanEp = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${prefix}${cleanEp}`;
};

export const getActiveServerUrl = (): string => activeServerUrl;

const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = getApiUrl(endpoint);
  return fetch(url, options);
};

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
  getArtworkUrl: (url: string | null | undefined): string | null => {
    if (!url) return null;
    return getApiUrl(url);
  },

  // Auth
  login: async (password: string) => {
    const res = await apiFetch('/api/auth/login', {
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
    const res = await apiFetch('/api/auth/status', {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  logout: async () => {
    localStorage.removeItem('clementine_token');
    await apiFetch('/api/auth/logout', { method: 'POST' });
  },

  // Player
  getStatus: async (): Promise<PlayerStatus> => {
    const res = await apiFetch('/api/player/status', { headers: getHeaders() });
    return handleResponse(res);
  },

  play: async () => {
    const res = await apiFetch('/api/player/play', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  pause: async () => {
    const res = await apiFetch('/api/player/pause', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  playPause: async () => {
    const res = await apiFetch('/api/player/play_pause', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  stop: async () => {
    const res = await apiFetch('/api/player/stop', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  next: async () => {
    const res = await apiFetch('/api/player/next', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  previous: async () => {
    const res = await apiFetch('/api/player/previous', { method: 'POST', headers: getHeaders() });
    return handleResponse(res);
  },

  setVolume: async (volume: number) => {
    const res = await apiFetch('/api/player/volume', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ volume }),
    });
    return handleResponse(res);
  },

  seek: async (position: number) => {
    const res = await apiFetch('/api/player/seek', {
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
    const res = await apiFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  getSleepTimer: async (): Promise<SleepTimerStatus> => {
    const res = await apiFetch('/api/player/sleep-timer', { headers: getHeaders() });
    return handleResponse(res);
  },

  startSleepTimer: async (params: { duration_minutes?: number; duration_seconds?: number; end_of_track?: boolean }): Promise<SleepTimerStatus> => {
    const res = await apiFetch('/api/player/sleep-timer', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    return handleResponse(res);
  },

  cancelSleepTimer: async (): Promise<SleepTimerStatus> => {
    const res = await apiFetch('/api/player/sleep-timer', {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  setShuffle: async (mode: number) => {
    const res = await apiFetch('/api/player/shuffle', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ mode }),
    });
    return handleResponse(res);
  },

  setRepeat: async (mode: number) => {
    const res = await apiFetch('/api/player/repeat', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ mode }),
    });
    return handleResponse(res);
  },

  // Playlist
  getPlaylists: async (): Promise<PlaylistInfo[]> => {
    const res = await apiFetch('/api/playlist/', { headers: getHeaders() });
    return handleResponse(res);
  },

  getPlaylistSongs: async (playlistId: number, refresh: boolean = false): Promise<TrackMetadata[]> => {
    const url = `/api/playlist/${playlistId}/songs${refresh ? '?refresh=true' : ''}`;
    const res = await apiFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  changeSong: async (playlistId: number, songIndex: number) => {
    const res = await apiFetch('/api/playlist/change_song', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId, song_index: songIndex }),
    });
    return handleResponse(res);
  },

  insertUrls: async (playlistId: number, urls: string[], playNow = false, enqueue = false) => {
    const res = await apiFetch('/api/playlist/insert', {
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
    const res = await apiFetch('/api/playlist/remove', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId, song_indices: songIndices }),
    });
    return handleResponse(res);
  },

  clearPlaylist: async (playlistId?: number) => {
    const res = await apiFetch('/api/playlist/clear', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId }),
    });
    return handleResponse(res);
  },

  createPlaylist: async (name: string) => {
    const res = await apiFetch('/api/playlist/create', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res);
  },

  renamePlaylist: async (playlistId: number, name: string) => {
    const res = await apiFetch('/api/playlist/rename', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playlist_id: playlistId, name }),
    });
    return handleResponse(res);
  },

  activatePlaylist: async (playlistId: number) => {
    const res = await apiFetch(`/api/playlist/${playlistId}/activate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  closePlaylist: async (playlistId: number) => {
    const res = await apiFetch(`/api/playlist/${playlistId}/close`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Library
  getArtists: async (format?: string): Promise<ArtistItem[]> => {
    const url = format ? `/api/library/artists?format=${encodeURIComponent(format)}` : '/api/library/artists';
    const res = await apiFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  getAlbums: async (artist?: string, format?: string): Promise<AlbumItem[]> => {
    let url = '/api/library/albums?';
    if (artist) url += `artist=${encodeURIComponent(artist)}&`;
    if (format) url += `format=${encodeURIComponent(format)}&`;
    const res = await apiFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  getTracks: async (artist?: string, album?: string, format?: string): Promise<TrackMetadata[]> => {
    let url = '/api/library/tracks?';
    if (artist) url += `artist=${encodeURIComponent(artist)}&`;
    if (album) url += `album=${encodeURIComponent(album)}&`;
    if (format) url += `format=${encodeURIComponent(format)}&`;
    const res = await apiFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  search: async (query: string, format?: string): Promise<SearchResults> => {
    let url = `/api/library/search?q=${encodeURIComponent(query)}`;
    if (format) url += `&format=${encodeURIComponent(format)}`;
    const res = await apiFetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  // System
  getSystemInfo: async (): Promise<SystemInfo> => {
    const res = await apiFetch('/api/system/info');
    return handleResponse(res);
  },
};
