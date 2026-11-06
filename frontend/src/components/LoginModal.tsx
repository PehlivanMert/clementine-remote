import React, { useState } from 'react';
import { Lock, Radio } from 'lucide-react';
import { api } from '../api';

interface LoginModalProps {
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err: any) {
      setError('Incorrect password. Default is "clementine"');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-hifi-850 border border-white/10 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-amber-500/25">
          <Radio className="w-7 h-7 text-black" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Clementine Remote</h2>
        <p className="text-xs text-neutral-400 mb-6">
          Enter password to access local playback control
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition"
          >
            {loading ? 'Authenticating...' : 'Unlock Remote'}
          </button>
        </form>
      </div>
    </div>
  );
};
