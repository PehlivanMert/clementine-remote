import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LibraryView } from '../components/LibraryView';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    getAlbums: vi.fn(),
    getArtists: vi.fn(),
    getTracks: vi.fn(),
    insertUrls: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}));

const mockAlbums = [
  {
    name: 'The Wall',
    artist: 'Pink Floyd',
    year: '1979',
    track_count: 26,
    art_available: true,
    sample_track_url: 'file:///music/the_wall/01.flac',
  },
];

const mockArtists = [
  {
    name: 'Pink Floyd',
    track_count: 50,
    album_count: 4,
  },
];

describe('LibraryView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getAlbums as any).mockResolvedValue(mockAlbums);
    (api.getArtists as any).mockResolvedValue(mockArtists);
    (api.getTracks as any).mockResolvedValue([]);
  });

  it('renders albums with artwork images and metadata', async () => {
    render(<LibraryView activePlaylistId={5} />);

    await waitFor(() => {
      expect(screen.getByText('The Wall')).toBeInTheDocument();
      expect(screen.getByText('Pink Floyd')).toBeInTheDocument();
      expect(screen.getByText('26 tracks')).toBeInTheDocument();
    });

    const img = screen.getByAltText('The Wall');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain(encodeURIComponent('file:///music/the_wall/01.flac'));
  });

  it('switches to artists tab and renders artist list', async () => {
    render(<LibraryView activePlaylistId={5} />);

    const artistsTab = screen.getByRole('button', { name: /artists/i });
    fireEvent.click(artistsTab);

    await waitFor(() => {
      expect(api.getArtists).toHaveBeenCalled();
      expect(screen.getByText('Pink Floyd')).toBeInTheDocument();
      expect(screen.getByText('4 albums • 50 songs')).toBeInTheDocument();
    });
  });

  it('plays all tracks using the active playlist ID', async () => {
    const mockAlbumTracks = [
      {
        index: 0,
        title: 'In the Flesh?',
        artist: 'Pink Floyd',
        album: 'The Wall',
        length: 200,
        pretty_length: '3:20',
        is_local: true,
        url: 'file:///music/the_wall/01.flac',
      },
    ];
    (api.getTracks as any).mockResolvedValue(mockAlbumTracks);

    render(<LibraryView activePlaylistId={5} />);

    await waitFor(() => {
      expect(screen.getByText('The Wall')).toBeInTheDocument();
    });

    // Click album to drill down
    fireEvent.click(screen.getByText('The Wall'));

    await waitFor(() => {
      expect(screen.getByText('In the Flesh?')).toBeInTheDocument();
    });

    const playAllBtn = screen.getByRole('button', { name: /play all/i });
    fireEvent.click(playAllBtn);

    expect(api.insertUrls).toHaveBeenCalledWith(
      5,
      ['file:///music/the_wall/01.flac'],
      true,
      false
    );
  });

  it('filters albums by format when format filter pill is clicked', async () => {
    render(<LibraryView activePlaylistId={5} />);

    await waitFor(() => {
      expect(api.getAlbums).toHaveBeenCalledWith(undefined, undefined);
    });

    const flacPill = screen.getByRole('button', { name: 'FLAC' });
    fireEvent.click(flacPill);

    await waitFor(() => {
      expect(api.getAlbums).toHaveBeenCalledWith(undefined, 'FLAC');
    });
  });
});
