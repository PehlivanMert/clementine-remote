import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlaylistView } from '../components/PlaylistView';
import { PlaylistInfo, TrackMetadata, PlayerStatus } from '../types';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    changeSong: vi.fn(),
    removeSongs: vi.fn(),
    clearPlaylist: vi.fn().mockResolvedValue({ status: 'ok' }),
  },
}));

const mockPlaylist: PlaylistInfo = {
  id: 3,
  name: 'Favorites Queue',
  item_count: 2,
  active: true,
  closed: false,
  favorite: false,
};

const mockSongs: TrackMetadata[] = [
  {
    index: 0,
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'Dark Side of the Moon',
    length: 425,
    pretty_length: '7:05',
    is_local: true,
    url: 'file:///music/time.flac',
  },
  {
    index: 1,
    title: 'Money',
    artist: 'Pink Floyd',
    album: 'Dark Side of the Moon',
    length: 382,
    pretty_length: '6:22',
    is_local: true,
    url: 'file:///music/money.flac',
  },
];

const mockStatus: PlayerStatus = {
  state: 'Playing',
  current_track: mockSongs[0],
  position: 50,
  duration: 425,
  volume: 80,
  repeat_mode: 0,
  shuffle_mode: 0,
  clementine_connected: true,
  clementine_version: '1.4 rc2',
};

describe('PlaylistView Component', () => {
  it('renders queue tracks and artwork thumbnails', () => {
    render(<PlaylistView playlist={mockPlaylist} songs={mockSongs} status={mockStatus} />);

    expect(screen.getByText('Favorites Queue')).toBeInTheDocument();
    expect(screen.getByText('2 tracks')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Money')).toBeInTheDocument();
  });

  it('triggers changeSong with correct playlist ID when track is clicked', () => {
    render(<PlaylistView playlist={mockPlaylist} songs={mockSongs} status={mockStatus} />);

    const trackRow = screen.getByText('Money');
    fireEvent.click(trackRow);
    expect(api.changeSong).toHaveBeenCalledWith(3, 1);
  });

  it('removes track with accessible delete button', () => {
    render(<PlaylistView playlist={mockPlaylist} songs={mockSongs} status={mockStatus} />);

    const removeBtn = screen.getByLabelText('Remove Time from queue');
    fireEvent.click(removeBtn);
    expect(api.removeSongs).toHaveBeenCalledWith(3, [0]);
  });

  it('shows clear confirmation modal and calls clearPlaylist on confirmation', async () => {
    render(<PlaylistView playlist={mockPlaylist} songs={mockSongs} status={mockStatus} />);

    const clearQueueBtn = screen.getByText('Clear Queue');
    fireEvent.click(clearQueueBtn);

    // Modal should appear
    expect(screen.getByText('Clear Queue?')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove all 2 tracks/i)).toBeInTheDocument();

    // Confirm button inside modal
    const confirmBtn = screen.getAllByText('Clear Queue')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.clearPlaylist).toHaveBeenCalledWith(3);
    });
  });
});
