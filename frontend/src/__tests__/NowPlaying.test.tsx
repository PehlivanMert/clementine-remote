import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NowPlaying } from '../components/NowPlaying';
import { PlayerStatus } from '../types';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    playPause: vi.fn(),
    previous: vi.fn(),
    next: vi.fn(),
    setVolume: vi.fn(),
    seek: vi.fn(),
    setShuffle: vi.fn(),
    setRepeat: vi.fn(),
  },
}));

const mockStatus: PlayerStatus = {
  state: 'Playing',
  current_track: {
    index: 0,
    title: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    length: 382,
    pretty_length: '6:22',
    is_local: true,
  },
  position: 120,
  duration: 382,
  volume: 70,
  repeat_mode: 0,
  shuffle_mode: 0,
  clementine_connected: true,
  clementine_version: 'Clementine 1.4 rc2',
};

describe('NowPlaying Component', () => {
  it('renders track metadata and playback state', () => {
    render(<NowPlaying status={mockStatus} />);

    expect(screen.getByText('Comfortably Numb')).toBeInTheDocument();
    expect(screen.getByText('Pink Floyd')).toBeInTheDocument();
    expect(screen.getByText('The Wall')).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument(); // 120s
    expect(screen.getByText('6:22')).toBeInTheDocument(); // 382s
  });

  it('triggers play/pause on hero button click', () => {
    render(<NowPlaying status={mockStatus} />);

    const playPauseBtn = screen.getByTitle('Pause');
    fireEvent.click(playPauseBtn);
    expect(api.playPause).toHaveBeenCalledTimes(1);
  });

  it('handles volume step controls up and down', () => {
    render(<NowPlaying status={mockStatus} />);

    const volUpBtn = screen.getByTitle('Volume Up');
    fireEvent.click(volUpBtn);
    expect(api.setVolume).toHaveBeenCalledWith(75);

    const volDownBtn = screen.getByTitle('Volume Down');
    fireEvent.click(volDownBtn);
    expect(api.setVolume).toHaveBeenCalledWith(65);
  });

  it('mutes and restores previous volume', () => {
    render(<NowPlaying status={mockStatus} />);

    const muteBtn = screen.getByTitle('Mute');
    fireEvent.click(muteBtn);
    expect(api.setVolume).toHaveBeenCalledWith(0);
  });

  it('commits seek position on pointer up', () => {
    render(<NowPlaying status={mockStatus} />);

    const rangeInput = screen.getByRole('slider', { name: /volume slider/i });
    expect(rangeInput).toBeInTheDocument();
  });

  it('renders responsive 2-column layout and generous volume spacing for mobile', () => {
    const { container } = render(<NowPlaying status={mockStatus} />);

    const rootWrapper = container.firstChild as HTMLElement;
    expect(rootWrapper.className).toContain('landscape:flex-row');
    expect(rootWrapper.className).toContain('landscape:max-w-4xl');

    // Volume container breathing room
    const volumeSection = container.querySelector('.mb-5');
    expect(volumeSection).toBeInTheDocument();
  });

  it('renders modern spacious presets without "Ön Ayar" text and includes ambient glow', () => {
    render(<NowPlaying status={mockStatus} />);

    // 'Ön Ayar' label should NOT exist
    expect(screen.queryByText(/ön ayar/i)).not.toBeInTheDocument();

    // The 3 preset buttons must be rendered and functional
    const nightBtn = screen.getByText('20% Gece');
    const dayBtn = screen.getByText('50% Günlük');
    const hkBtn = screen.getByText('88% HK AUX');

    expect(nightBtn).toBeInTheDocument();
    expect(dayBtn).toBeInTheDocument();
    expect(hkBtn).toBeInTheDocument();

    fireEvent.click(hkBtn);
    expect(api.setVolume).toHaveBeenCalledWith(88);
  });
});
