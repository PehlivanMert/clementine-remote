import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Cloud,
  RefreshCw,
  Disc,
  Headphones,
} from 'lucide-react';
import { TrackMetadata, PlayerStatus } from '../types';
import { resolveServerUrl, getApiUrl } from '../api';

interface OfflineViewProps {
  wsConnected: boolean;
  status: PlayerStatus | null;
  onRetry: () => void;
  onBrowseLibrary?: () => void;
}

export const OfflineView: React.FC<OfflineViewProps> = ({
  wsConnected,
  status,
  onRetry,
  onBrowseLibrary,
}) => {
  const [retrying, setRetrying] = useState(false);
  const [lastTrack, setLastTrack] = useState<{ track: TrackMetadata; savedAt: number } | null>(null);
  const [activeTunnel, setActiveTunnel] = useState<string>('');

  // Load last played track from memory
  useEffect(() => {
    try {
      const stored = localStorage.getItem('clementine_last_track');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.track) {
          setLastTrack(parsed);
        }
      }
      const tunnel = localStorage.getItem('clementine_server_url') || '';
      setActiveTunnel(tunnel);
    } catch {
      // ignore
    }
  }, [status]);

  const handleManualRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await resolveServerUrl(true);
      onRetry();
    } finally {
      setTimeout(() => setRetrying(false), 1200);
    }
  };

  const currentTrack = status?.current_track || lastTrack?.track;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-hifi-950 select-none text-slate-100 px-4 py-6">
      {/* Background Cinematic Artwork with Ambient Gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <picture>
          <source srcSet="./offline_bg.webp" type="image/webp" />
          <img
            src="./offline_bg.jpg"
            alt="Hi-Fi Offline Artwork"
            className="w-full h-full object-cover object-center filter brightness-[0.55] saturate-[1.15] scale-105 transition-transform duration-1000"
          />
        </picture>
        {/* Soft Radial & Linear Vignettes */}
        <div className="absolute inset-0 bg-gradient-to-t from-hifi-950 via-hifi-950/40 to-hifi-950/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(7,8,10,0.75)_100%)]" />
        {/* Ambient Warm Amber Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-amber-500/15 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      </div>

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-md landscape:max-w-3xl flex flex-col landscape:flex-row items-center justify-center gap-6 my-auto">
        {/* Left Column (Artwork / Disc Aura) */}
        <div className="flex flex-col items-center text-center">
          {/* Glowing Vinyl / Amplifier Hub */}
          <div className="relative group mb-3">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 p-2.5 shadow-2xl flex items-center justify-center transition-transform duration-500 hover:scale-105">
              {/* Inner ambient ring */}
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-amber-500/15 via-black/40 to-cyan-500/10 flex flex-col items-center justify-center relative overflow-hidden border border-white/5">
                <Disc className={`w-12 h-12 text-amber-400/90 ${retrying ? 'animate-spin' : ''}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 text-[9px] font-mono tracking-wider font-semibold text-amber-300/80 uppercase">
                  Hi-Fi V1.1
                </span>
              </div>
            </div>
            {/* Live Status Pip */}
            <div className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-hifi-900 border border-white/10 flex items-center space-x-1.5 shadow-lg">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
              <span className="text-[10px] font-medium text-neutral-300 tracking-wide">
                {wsConnected ? 'Bağlı' : 'Çevrimdışı'}
              </span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1">
            Clementine Bekleniyor
          </h2>
          <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
            Müzik çalar şu anda kapalı veya bilgisayar uykuda. Clementine başlatıldığında ekran otomatik olarak canlı çalara geçecektir.
          </p>
        </div>

        {/* Right Column (Memory & Connectivity Diagnostics) */}
        <div className="w-full flex-1 flex flex-col space-y-3.5 max-w-sm">
          {/* Last Played Track Card (Memory) */}
          {currentTrack && (
            <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 shadow-lg flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-hifi-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-sm">
                <img
                  src={getApiUrl(`/api/artwork/current?t=${currentTrack.title}`)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <Headphones className="w-5 h-5 text-neutral-500 absolute" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-400 font-mono">
                    Son Çalınan Parça
                  </span>
                  {currentTrack.audio_format && (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {currentTrack.audio_format}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-white truncate">
                  {currentTrack.title || 'Bilinmeyen Parça'}
                </p>
                <p className="text-[11px] text-neutral-400 truncate">
                  {currentTrack.artist || 'Clementine'}
                </p>
              </div>
            </div>
          )}

          {/* Connection Radar Diagnostic Badges */}
          <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-400">
              <div className="flex items-center space-x-2">
                <Wifi className="w-3.5 h-3.5 text-neutral-400" />
                <span>Yerel Wi-Fi</span>
              </div>
              <span className="font-mono text-[11px] text-neutral-300">172.20.5.94:8000</span>
            </div>

            <div className="flex items-center justify-between text-neutral-400">
              <div className="flex items-center space-x-2">
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cloudflare WSS Tünel</span>
              </div>
              <span className="font-mono text-[10px] text-cyan-300 truncate max-w-[150px]">
                {activeTunnel ? 'Aktif (Korumalı)' : 'ntfy.sh Köprüsü'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5 pt-1">
            <button
              onClick={handleManualRetry}
              disabled={retrying}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-semibold text-xs transition duration-200 shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              <span>{retrying ? 'Taranıyor...' : 'Yeniden Bağlan'}</span>
            </button>

            {onBrowseLibrary && (
              <button
                onClick={onBrowseLibrary}
                className="py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] active:scale-98 text-neutral-200 font-medium text-xs border border-white/10 transition duration-200"
              >
                Arşiv
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Bottom Credit */}
      <div className="relative z-10 text-[10px] text-neutral-500 font-mono tracking-wider mt-4">
        CLEMENTINE HI-FI BIT-PERFECT REMOTE &bull; DIDIM
      </div>
    </div>
  );
};
