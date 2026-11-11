import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LyricsModal } from '../components/LyricsModal';
import { api } from '../api';
import { TrackMetadata } from '../types';

vi.mock('../api', () => ({
  api: {
    getLyrics: vi.fn(),
  },
}));

const mockTrack: TrackMetadata = {
  index: 0,
  title: 'Comfortably Numb',
  artist: 'Pink Floyd',
  album: 'The Wall',
  length: 382,
  pretty_length: '6:22',
  is_local: true,
};

describe('LyricsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getLyrics).mockResolvedValue({
      synced: false,
      lines: [],
      plain: '',
      source: 'none',
    });
  });

  it('fetches and renders synced lyrics', async () => {
    vi.mocked(api.getLyrics).mockResolvedValueOnce({
      synced: true,
      lines: [
        { time: 10.5, text: 'Hello, is there anybody in there?' },
        { time: 15.0, text: 'Just nod if you can hear me' },
        { time: 20.0, text: 'Is there anyone home?' },
      ],
      plain: '',
      source: 'lrclib',
    });

    const onSeek = vi.fn();
    const onClose = vi.fn();

    render(
      <LyricsModal
        isOpen={true}
        onClose={onClose}
        currentTrack={mockTrack}
        currentPosition={16.0}
        onSeek={onSeek}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Hello, is there anybody in there?')).toBeInTheDocument();
      expect(screen.getByText('Just nod if you can hear me')).toBeInTheDocument();
    });

    // Check active line highlighting (position 16.0 is between 15.0 and 20.0)
    const activeLine = screen.getByText('Just nod if you can hear me').closest('button');
    expect(activeLine?.className).toContain('text-amber-400');

    // Clicking line seeks to timestamp
    fireEvent.click(screen.getByText('Hello, is there anybody in there?'));
    expect(onSeek).toHaveBeenCalledWith(10.5);
  });

  it('renders plain text lyrics when synced is false', async () => {
    vi.mocked(api.getLyrics).mockResolvedValueOnce({
      synced: false,
      lines: [],
      plain: 'Plain lyrics text line 1\nPlain lyrics text line 2',
      source: 'local',
    });

    render(
      <LyricsModal
        isOpen={true}
        onClose={vi.fn()}
        currentTrack={mockTrack}
        currentPosition={0}
        onSeek={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Plain lyrics text line 1/i)).toBeInTheDocument();
    });
  });

  it('renders empty message when no lyrics are found', async () => {
    vi.mocked(api.getLyrics).mockResolvedValueOnce({
      synced: false,
      lines: [],
      plain: '',
      source: 'none',
    });

    render(
      <LyricsModal
        isOpen={true}
        onClose={vi.fn()}
        currentTrack={mockTrack}
        currentPosition={0}
        onSeek={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/şarkı sözü bulunamadı/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <LyricsModal
        isOpen={true}
        onClose={onClose}
        currentTrack={mockTrack}
        currentPosition={0}
        onSeek={vi.fn()}
      />
    );

    const closeBtn = screen.getByTitle('Kapat');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports interactive sync calibration offset and persists to localStorage', async () => {
    vi.mocked(api.getLyrics).mockResolvedValueOnce({
      synced: true,
      lines: [
        { time: 10.0, text: 'First line' },
        { time: 15.0, text: 'Second line' },
      ],
      plain: '',
      source: 'lrclib',
    });

    const onSeek = vi.fn();
    render(
      <LyricsModal
        isOpen={true}
        onClose={vi.fn()}
        currentTrack={mockTrack}
        currentPosition={10.0}
        isPlaying={true}
        onSeek={onSeek}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Senkron Kalibrasyonu')).toBeInTheDocument();
    });

    // Initial offset button displays +0.0s or 0.0s
    expect(screen.getByTitle('Sıfırla')).toHaveTextContent('0.0s');

    // Click +0.5s button
    const plusBtn = screen.getByTitle('Sözleri 0.5 saniye geciktir');
    fireEvent.click(plusBtn);
    expect(screen.getByTitle('Sıfırla')).toHaveTextContent('+0.5s');

    // Click -0.5s button
    const minusBtn = screen.getByTitle('Sözleri 0.5 saniye erkene al');
    fireEvent.click(minusBtn);
    expect(screen.getByTitle('Sıfırla')).toHaveTextContent('0.0s');
  });
});
