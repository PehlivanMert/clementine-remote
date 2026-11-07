import React, { useState, useEffect } from 'react';
import { Smartphone, Server, LogOut, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { SystemInfo } from '../types';
import { api } from '../api';

interface SystemViewProps {
  onLogout: () => void;
}

export const SystemView: React.FC<SystemViewProps> = ({ onLogout }) => {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemInfo();
      setInfo(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md landscape:max-w-4xl mx-auto px-4 py-4 w-full pb-10">
      <div className="flex items-center justify-between mb-5 pb-2 border-b border-white/5">
        <h2 className="text-lg font-bold text-white">System & Remote Access</h2>
        <button
          onClick={loadInfo}
          disabled={loading}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition"
          title="Refresh system info"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 landscape:grid-cols-2 gap-4 mb-5">
        <div className="space-y-4">
          {/* iPhone URL Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
            <div className="flex items-center space-x-2 text-amber-500 mb-2">
              <Smartphone className="w-5 h-5" />
              <h3 className="text-sm font-bold">iPhone Safari Access URL</h3>
            </div>
            <p className="text-xs text-neutral-300 mb-3">
              Open Safari on your iPhone connected to Wi-Fi and navigate to:
            </p>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-sm font-bold text-amber-400 text-center select-all">
              {info?.iphone_url || 'http://172.20.5.94:8000'}
            </div>
          </div>

          {/* Backend & Clementine Status */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Server className="w-4 h-4 text-neutral-400" />
              <span>Server Details</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Local LAN IP</span>
                <span className="font-mono font-semibold text-neutral-200">{info?.lan_ip || '172.20.5.94'}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Web Remote Port</span>
                <span className="font-mono font-semibold text-neutral-200">{info?.server_port || 8000}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Clementine Remote</span>
                <div className="flex items-center space-x-1 mt-0.5">
                  {info?.clementine_connected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold text-emerald-400">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="font-semibold text-rose-400">Disconnected</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Clementine Version</span>
                <span className="font-mono text-neutral-200 truncate block">{info?.clementine_version || '1.4 rc2'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* iOS Installation Instructions */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5 text-xs text-neutral-300 flex flex-col justify-center">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center space-x-2">
            <span>Add to iPhone Home Screen (PWA)</span>
          </h3>
          <div className="flex items-start space-x-2.5">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
            <p>Open the URL above in <strong>Safari</strong> on your iPhone.</p>
          </div>
          <div className="flex items-start space-x-2.5">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
            <p>Tap the <strong>Share</strong> button at the bottom of Safari (square with arrow up).</p>
          </div>
          <div className="flex items-start space-x-2.5">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">3</span>
            <p>Scroll down and tap <strong>Add to Home Screen</strong>.</p>
          </div>
          <div className="flex items-start space-x-2.5">
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">4</span>
            <p>The app will launch full-screen with native Hi-Fi experience!</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full flex items-center justify-center space-x-2 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition active:scale-98"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out of Web Remote</span>
      </button>
    </div>
  );
};
