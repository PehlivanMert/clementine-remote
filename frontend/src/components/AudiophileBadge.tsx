import React from 'react';
import { TrackMetadata } from '../types';

interface AudiophileBadgeProps {
  track: TrackMetadata | null | undefined;
  className?: string;
}

export const AudiophileBadge: React.FC<AudiophileBadgeProps> = ({ track, className = '' }) => {
  if (!track || (!track.audio_format && !track.bit_rate)) {
    return null;
  }

  const format = (track.audio_format || '').toUpperCase();
  const isLossless = ['FLAC', 'ALAC', 'WAV', 'AIFF', 'APE', 'WV'].includes(format);
  const isHiRes = Boolean(track.is_hi_res);

  const sampleRateKHz = track.sample_rate
    ? (track.sample_rate / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })
    : null;

  if (isHiRes) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 backdrop-blur-sm shadow-sm ${className}`}
        title="High-Resolution Lossless Audio"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>HI-RES LOSSLESS</span>
        {(track.bit_depth || sampleRateKHz) && (
          <span className="text-amber-400/80 font-normal">
            • {track.bit_depth ? `${track.bit_depth}-BIT` : ''}
            {track.bit_depth && sampleRateKHz ? ' / ' : ''}
            {sampleRateKHz ? `${sampleRateKHz} kHz` : ''}
          </span>
        )}
      </div>
    );
  }

  if (isLossless) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm ${className}`}
        title="CD Quality Lossless Audio"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span>LOSSLESS</span>
        {(track.bit_depth || sampleRateKHz) && (
          <span className="text-cyan-400/80 font-normal">
            • {track.bit_depth ? `${track.bit_depth}-BIT` : ''}
            {track.bit_depth && sampleRateKHz ? ' / ' : ''}
            {sampleRateKHz ? `${sampleRateKHz} kHz` : ''}
          </span>
        )}
      </div>
    );
  }

  // Lossy (MP3, AAC, OGG, etc.)
  const kbps = track.bit_rate ? Math.round(track.bit_rate / 1000) : null;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-slate-700/40 text-slate-300 border border-slate-600/30 backdrop-blur-sm ${className}`}
      title="Compressed Audio"
    >
      <span>{format || 'MP3'}</span>
      {kbps && <span className="text-slate-400 font-normal">• {kbps} kbps</span>}
    </div>
  );
};
