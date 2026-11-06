import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchView } from '../components/SearchView';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    search: vi.fn(),
    insertUrls: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}));

const mockSearchResults = {
  query: 'Pink',
  artists: [{ name: 'Pink Floyd', track_count: 50, album_count: 4 }],
  albums: [{ name: 'The Wall', artist: 'Pink Floyd', year: '1979', track_count: 26, art_available: true, sample_track_url: 'file:///music/wall.flac' }],
  tracks: [{ index: 0, title: 'Comfortably Numb', artist: 'Pink Floyd', album: 'The Wall', length: 382, pretty_length: '6:22', is_local: true, url: 'file:///music/numb.flac' }],
};

describe('SearchView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.search as any).mockResolvedValue(mockSearchResults);
  });

  it('debounces search input and displays results with thumbnails', async () => {
    render(<SearchView activePlaylistId={7} />);

    const searchInput = screen.getByPlaceholderText(/search songs, artists, albums/i);
    fireEvent.change(searchInput, { target: { value: 'Pink' } });

    await waitFor(() => {
      expect(api.search).toHaveBeenCalledWith('Pink');
      expect(screen.getAllByText('Pink Floyd')[0]).toBeInTheDocument();
      expect(screen.getByText('The Wall')).toBeInTheDocument();
      expect(screen.getByText('Comfortably Numb')).toBeInTheDocument();
    });
  });

  it('queues a track from search results using the active playlist ID', async () => {
    render(<SearchView activePlaylistId={7} />);

    const searchInput = screen.getByPlaceholderText(/search songs, artists, albums/i);
    fireEvent.change(searchInput, { target: { value: 'Pink' } });

    await waitFor(() => {
      expect(screen.getByText('Comfortably Numb')).toBeInTheDocument();
    });

    const queueBtn = screen.getByLabelText('Queue Comfortably Numb');
    fireEvent.click(queueBtn);

    expect(api.insertUrls).toHaveBeenCalledWith(
      7,
      ['file:///music/numb.flac'],
      false,
      true
    );
  });
});
