import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AudiophileBadge } from '../components/AudiophileBadge';
import { TrackMetadata } from '../types';

describe('AudiophileBadge Component', () => {
  it('renders Hi-Res Lossless badge for 24-bit / 96 kHz FLAC', () => {
    const track: TrackMetadata = {
      index: 0,
      title: 'Hi-Res Track',
      artist: 'Audiophile Artist',
      album: 'Test Album',
      length: 180,
      pretty_length: '3:00',
      is_local: true,
      audio_format: 'FLAC',
      bit_depth: 24,
      sample_rate: 96000,
      bit_rate: 2800000,
      is_hi_res: true,
    };

    render(<AudiophileBadge track={track} />);
    expect(screen.getByText(/HI-RES LOSSLESS/i)).toBeInTheDocument();
    expect(screen.getByText(/24-BIT \/ 96 kHz/i)).toBeInTheDocument();
  });

  it('renders Lossless badge for 16-bit / 44.1 kHz FLAC', () => {
    const track: TrackMetadata = {
      index: 0,
      title: 'CD Quality Track',
      artist: 'CD Artist',
      album: 'CD Album',
      length: 200,
      pretty_length: '3:20',
      is_local: true,
      audio_format: 'FLAC',
      bit_depth: 16,
      sample_rate: 44100,
      is_hi_res: false,
    };

    render(<AudiophileBadge track={track} />);
    expect(screen.getByText(/^LOSSLESS$/i)).toBeInTheDocument();
    expect(screen.getByText(/16-BIT \/ 44.1 kHz/i)).toBeInTheDocument();
  });

  it('renders MP3 badge for 320 kbps MP3', () => {
    const track: TrackMetadata = {
      index: 0,
      title: 'Lossy Track',
      artist: 'Lossy Artist',
      album: 'Lossy Album',
      length: 150,
      pretty_length: '2:30',
      is_local: true,
      audio_format: 'MP3',
      bit_rate: 320000,
      is_hi_res: false,
    };

    render(<AudiophileBadge track={track} />);
    expect(screen.getByText(/MP3/i)).toBeInTheDocument();
    expect(screen.getByText(/320 kbps/i)).toBeInTheDocument();
  });

  it('returns null if track has no audio format or is empty', () => {
    const { container } = render(<AudiophileBadge track={null} />);
    expect(container.firstChild).toBeNull();
  });
});
