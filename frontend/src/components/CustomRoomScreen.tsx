import { useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import type { GameMode } from '../types';

export function CustomRoomScreen() {
  const {
    customRoomState,
    createCustomRoom,
    joinCustomRoom,
    clearCustomRoomJoinError,
    leaveMatch,
  } = useNakama();

  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [createMode, setCreateMode] = useState<GameMode>('classic');
  const [slugInput, setSlugInput] = useState('');
  const [localJoinError, setLocalJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    await createCustomRoom(createMode);
  };

  const handleJoin = async () => {
    if (!slugInput.trim()) {
      setLocalJoinError('Please enter a room code.');
      return;
    }
    setLocalJoinError(null);
    await joinCustomRoom(slugInput);
  };

  const handleSlugInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugInput(e.target.value);
    if (localJoinError) setLocalJoinError(null);
    clearCustomRoomJoinError();
  };

  const handleCopy = async () => {
    if (!customRoomState.createdSlug) return;
    try {
      await navigator.clipboard.writeText(customRoomState.createdSlug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied
    }
  };

  const joinError = localJoinError ?? customRoomState.joinError;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="flex flex-col items-center gap-8 w-full max-w-[360px]">
        {/* Header */}
        <div className="animate-fade-up flex flex-col items-center gap-2">
          <h1 className="font-display text-3xl font-700 letter-tight text-txt-primary">
            Private Room
          </h1>
          <div className="rule w-12 mt-1" />
        </div>

        {/* Back */}
        <button
          onClick={leaveMatch}
          className="fixed top-6 left-6 px-3 py-1.5 text-xs font-medium text-txt-muted border border-border rounded-md transition-all duration-150 hover:text-txt-secondary hover:border-border-strong z-20"
        >
          Back
        </button>

        {/* Tabs */}
        <div className="animate-fade-up-d1 flex w-full bg-surface border border-border rounded-md p-1">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-sm font-medium rounded transition-all duration-150 ${
              activeTab === 'create'
                ? 'bg-elevated text-txt-primary'
                : 'text-txt-muted hover:text-txt-secondary'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 text-sm font-medium rounded transition-all duration-150 ${
              activeTab === 'join'
                ? 'bg-elevated text-txt-primary'
                : 'text-txt-muted hover:text-txt-secondary'
            }`}
          >
            Join
          </button>
        </div>

        {/* Tab content */}
        <div className="animate-fade-up-d2 w-full">
          {activeTab === 'create' && (
            <div className="flex flex-col gap-4">
              {customRoomState.createdSlug ? (
                /* Room created — waiting for opponent */
                <div className="flex flex-col items-center gap-5">
                  <p className="text-xs font-medium text-txt-muted uppercase tracking-widest">
                    Share this code
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-2xl font-medium text-txt-primary tracking-wide">
                      {customRoomState.createdSlug}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="px-2.5 py-1 text-xs font-medium text-txt-muted bg-surface border border-border rounded-md transition-all duration-150 hover:text-txt-secondary hover:border-border-strong active:scale-[0.98]"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="rule w-full" />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '200ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-sm text-txt-muted">Waiting for opponent</span>
                  </div>
                </div>
              ) : (
                /* Create form */
                <>
                  <label className="text-xs font-medium text-txt-muted uppercase tracking-widest">
                    Game mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreateMode('classic')}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-md border transition-all duration-150 ${
                        createMode === 'classic'
                          ? 'bg-accent-subtle border-accent text-accent'
                          : 'bg-surface border-border text-txt-muted hover:text-txt-secondary hover:border-border-strong'
                      }`}
                    >
                      Classic
                    </button>
                    <button
                      onClick={() => setCreateMode('timed')}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-md border transition-all duration-150 ${
                        createMode === 'timed'
                          ? 'bg-accent-subtle border-accent text-accent'
                          : 'bg-surface border-border text-txt-muted hover:text-txt-secondary hover:border-border-strong'
                      }`}
                    >
                      Timed
                    </button>
                  </div>
                  <button
                    onClick={handleCreate}
                    disabled={customRoomState.isCreating}
                    className="w-full px-4 py-3 bg-accent text-sm font-semibold rounded-md transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                    style={{ color: '#0a0a0b' }}
                  >
                    {customRoomState.isCreating ? 'Creating...' : 'Create Room'}
                  </button>
                  {customRoomState.createError && (
                    <p className="text-sm text-lose">{customRoomState.createError}</p>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'join' && (
            <div className="flex flex-col gap-4">
              <label className="text-xs font-medium text-txt-muted uppercase tracking-widest">
                Room code
              </label>
              <input
                type="text"
                placeholder="e.g. amber-fox-42"
                value={slugInput}
                onChange={handleSlugInputChange}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                disabled={customRoomState.isJoining}
                className="w-full px-4 py-3 bg-surface border border-border rounded-md text-txt-primary font-mono placeholder-txt-muted text-base focus:outline-none focus:border-accent transition-colors duration-150 disabled:opacity-50"
              />
              {joinError && (
                <p className="text-sm text-lose -mt-2">{joinError}</p>
              )}
              <button
                onClick={handleJoin}
                disabled={customRoomState.isJoining}
                className="w-full px-4 py-3 bg-accent text-sm font-semibold rounded-md transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                style={{ color: '#0a0a0b' }}
              >
                {customRoomState.isJoining ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
