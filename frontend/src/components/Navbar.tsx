import React from 'react';
import { Radio, Wifi, WifiOff } from 'lucide-react';
import { PlayerStatus } from '../types';

interface NavbarProps {
  status: PlayerStatus | null;
  wsConnected: boolean;
  onOpenSystem: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ status, wsConnected, onOpenSystem }) => {
  const clementineOk = status?.clementine_connected;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-hifi-950/80 backdrop-blur-md border-b border-white/5 safe-top">
      <div className="max-w-md landscape:max-w-4xl mx-auto px-4 safe-x h-14 landscape:h-11 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 landscape:w-6 landscape:h-6 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Radio className="w-4 h-4 landscape:w-3.5 landscape:h-3.5 text-black" />
          </div>
          <span className="font-semibold tracking-tight text-white text-base landscape:text-sm">Clementine</span>
          <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-neutral-400">Hi-Fi</span>
        </div>

        <button
          onClick={onOpenSystem}
          className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition border border-white/5 text-xs text-neutral-300"
          title="Click to view connection info"
        >
          <span className="relative flex h-2 w-2">
            {clementineOk && wsConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            )}
          </span>
          <span className="font-mono text-[11px] landscape:text-[10px]">
            {clementineOk ? 'Connected' : 'Offline'}
          </span>
          {wsConnected ? (
            <Wifi className="w-3.5 h-3.5 landscape:w-3 landscape:h-3 text-neutral-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 landscape:w-3 landscape:h-3 text-rose-400" />
          )}
        </button>
      </div>
    </header>
  );
};
