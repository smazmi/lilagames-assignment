import { useState } from 'react';
import { useNakama } from '../context/NakamaContext';

const DEVICE_ID_KEY = 'xoxo_device_id';

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function HomeScreen() {
  const { authenticate, joinMatchmaker, logout, showLeaderboard, showCustomRoom, currentUserId, currentUserName, restoring } = useNakama();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAuthenticated = currentUserId !== '';

  const handleAuth = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    setAuthError(null);
    setActionError(null);
    const deviceId = getOrCreateDeviceId();
    try {
      await authenticate(deviceId, nickname.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const message = msg.includes('Username is already in use')
        ? 'That nickname is already in use. Please choose another one.'
        : 'Could not connect right now. Please try again.';
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (mode: 'classic' | 'timed') => {
    setLoading(true);
    setActionError(null);
    try {
      await joinMatchmaker(mode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg || 'Could not start matchmaking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (restoring) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="flex flex-col items-center gap-4">
          <h1 className="font-display text-5xl font-800 letter-tighter text-txt-primary">
            XoXo
          </h1>
          <div className="flex items-center gap-3">
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      {/* Background glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="flex flex-col items-center gap-10 w-full max-w-[320px]">
        {/* Logo */}
        <div className="animate-fade-up flex flex-col items-center gap-2">
          <h1 className="font-display text-5xl font-800 letter-tighter text-txt-primary">
            XoXo
          </h1>
          <div className="rule w-16 mt-1" />
        </div>

        {!isAuthenticated ? (
          <div className="animate-fade-up-d1 flex flex-col gap-4 w-full">
            <label className="text-xs font-medium text-txt-muted uppercase tracking-widest">
              Choose a name
            </label>
            <input
              type="text"
              placeholder="Nickname"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (authError) setAuthError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              className="w-full px-4 py-3 bg-surface border border-border rounded-md text-txt-primary placeholder-txt-muted font-body text-base focus:outline-none focus:border-accent transition-colors duration-150"
              disabled={loading}
            />
            {authError && (
              <p className="text-sm text-red-400">
                {authError}
              </p>
            )}
            <button
              onClick={handleAuth}
              disabled={loading || !nickname.trim()}
              className="w-full px-4 py-3 bg-accent text-base font-semibold rounded-md transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{ color: '#0a0a0b' }}
            >
              {loading ? 'Connecting...' : 'Enter'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            {/* User bar */}
            <div className="animate-fade-up-d1 flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-md">
              <span className="text-sm text-txt-secondary">
                <span className="text-txt-primary font-semibold">{currentUserName}</span>
              </span>
              <button
                onClick={logout}
                className="text-xs text-txt-muted hover:text-txt-secondary transition-colors duration-150"
              >
                Sign out
              </button>
            </div>

            {/* Action buttons */}
            <div className="rule w-full my-1" />

            {actionError && (
              <p className="text-sm text-red-400">
                {actionError}
              </p>
            )}

            <button
              onClick={() => handlePlay('classic')}
              disabled={loading}
              className="animate-fade-up-d2 w-full px-4 py-3.5 bg-accent text-base font-semibold rounded-md transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{ color: '#0a0a0b' }}
            >
              Play Classic
            </button>

            <button
              onClick={() => handlePlay('timed')}
              disabled={loading}
              className="animate-fade-up-d3 w-full px-4 py-3.5 bg-surface border border-border text-txt-primary text-base font-semibold rounded-md transition-all duration-150 hover:border-border-strong hover:bg-elevated active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Play Timed
            </button>

            <button
              onClick={showCustomRoom}
              disabled={loading}
              className="animate-fade-up-d4 w-full px-4 py-3.5 bg-surface border border-border text-txt-primary text-base font-semibold rounded-md transition-all duration-150 hover:border-border-strong hover:bg-elevated active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Private Room
            </button>

            <div className="rule w-full my-1" />

            <button
              onClick={showLeaderboard}
              disabled={loading}
              className="animate-fade-up-d5 w-full px-4 py-3 text-sm text-txt-muted font-medium transition-colors duration-150 hover:text-txt-secondary"
            >
              Leaderboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
