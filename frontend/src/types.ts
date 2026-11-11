export interface TrackMetadata {
  id?: number;
  index: number;
  title: string;
  artist: string;
  album: string;
  albumartist?: string;
  track?: number;
  disc?: number;
  length: number; // in seconds
  pretty_length: string;
  year?: string;
  genre?: string;
  is_local: boolean;
  filename?: string;
  url?: string;
  has_art?: boolean;
  audio_format?: string;
  bit_depth?: number;
  sample_rate?: number;
  bit_rate?: number;
  is_hi_res?: boolean;
}

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResponse {
  synced: boolean;
  lines: LyricsLine[];
  plain: string;
  source: string;
}

export interface SleepTimerStatus {
  active: boolean;
  remaining_seconds: number;
  initial_volume: number;
  is_fading: boolean;
}

export interface PlayerStatus {
  state: "Playing" | "Paused" | "Idle" | "Empty";
  current_track: TrackMetadata | null;
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0-100
  repeat_mode: number; // 0: Off, 1: Track, 2: Album, 3: Playlist, 4: OneByOne, 5: Intro
  shuffle_mode: number; // 0: Off, 1: All, 2: InsideAlbum, 3: Albums
  clementine_connected: boolean;
  clementine_version: string;
}

export interface PlaylistInfo {
  id: number;
  name: string;
  item_count: number;
  active: boolean;
  closed: boolean;
  favorite: boolean;
}

export interface ArtistItem {
  name: string;
  track_count: number;
  album_count: number;
  formats?: string[];
}

export interface AlbumItem {
  name: string;
  artist: string;
  year?: string;
  track_count: number;
  art_available: boolean;
  sample_track_url?: string;
  formats?: string[];
}

export interface SearchResults {
  query: string;
  artists: ArtistItem[];
  albums: AlbumItem[];
  tracks: TrackMetadata[];
}

export interface SystemInfo {
  server_name: string;
  version: string;
  lan_ip: string;
  server_port: number;
  iphone_url: string;
  clementine_connected: boolean;
  clementine_version: string;
  clementine_port: number;
  music_dir: string;
  library_tracks_count: number;
}
