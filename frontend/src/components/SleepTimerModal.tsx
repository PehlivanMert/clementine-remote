import React, { useState } from 'react';
import { Moon, X, Clock, PlayCircle, Loader2 } from 'lucide-react';
import { SleepTimerStatus } from '../types';
import { api } from '../api';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  timerStatus: SleepTimerStatus | null | undefined;
  onTimerUpdate: (status: SleepTimerStatus) => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  isOpen,
  onClose,
  timerStatus,
  onTimerUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [customMinutes, setCustomMinutes] = useState<string>('');

  if (!isOpen) return null;

  const isActive = Boolean(timerStatus?.active);
  const remaining = timerStatus?.remaining_seconds ?? 0;
  const isFading = Boolean(timerStatus?.is_fading);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStart = async (params: {
    duration_minutes?: number;
    duration_seconds?: number;
    end_of_track?: boolean;
  }) => {
    try {
      setLoading(true);
      const res = await api.startSleepTimer(params);
      onTimerUpdate(res);
    } catch (e) {
      console.error('Failed to start sleep timer:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setLoading(true);
      const res = await api.cancelSleepTimer();
      onTimerUpdate(res);
    } catch (e) {
      console.error('Failed to cancel sleep timer:', e);
    } finally {
      setLoading(false);
    }
  };

  const presets = [15, 30, 45, 60];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm flex flex-col bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Uyku Zamanlayıcısı</h3>
              <p className="text-xs text-neutral-400">Gece dinleme otomasyonu</p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Kapat"
            aria-label="Kapat"
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-6 flex flex-col items-center">
          {isActive ? (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="text-4xl font-mono font-bold tracking-tight text-indigo-300 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                {formatCountdown(remaining)}
              </div>

              {isFading ? (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  60s Yumuşak Ses Kısılma (Fade-Out) Devrede...
                </div>
              ) : (
                <p className="text-xs text-neutral-400 text-center">
                  Süre bittiğinde müzik durdurulacak ve ses eski seviyesine dönecektir.
                </p>
              )}

              <button
                onClick={handleCancel}
                disabled={loading}
                className="w-full py-2.5 px-4 mt-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-sm font-semibold transition active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Zamanlayıcıyı İptal Et</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                {presets.map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleStart({ duration_minutes: mins })}
                    disabled={loading}
                    className="py-3 px-4 rounded-xl bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/40 border border-white/10 text-white font-medium text-sm transition active:scale-95 flex items-center justify-center space-x-2"
                  >
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>{mins} dk</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleStart({ end_of_track: true })}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40 border border-white/10 text-white font-medium text-sm transition active:scale-95 flex items-center justify-center space-x-2"
              >
                <PlayCircle className="w-4 h-4 text-amber-400" />
                <span>Parça Sonu (End of Track)</span>
              </button>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="Özel dk (örn. 25)"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => {
                    const mins = parseInt(customMinutes, 10);
                    if (mins > 0) handleStart({ duration_minutes: mins });
                  }}
                  disabled={loading || !parseInt(customMinutes, 10)}
                  className="px-4 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition active:scale-95 cursor-pointer"
                >
                  Başlat
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
