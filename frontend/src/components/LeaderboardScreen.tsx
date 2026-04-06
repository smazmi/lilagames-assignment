import { useEffect, useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import type { LeaderboardRecord } from '../types';

export function LeaderboardScreen() {
  const { fetchLeaderboard, leaveMatch, currentUserName } = useNakama();
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard().then((r) => {
      setRecords(r);
      setLoading(false);
    });
  }, [fetchLeaderboard]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      {/* Back */}
      <button
        onClick={leaveMatch}
        className="fixed top-6 left-6 px-3 py-1.5 text-xs font-medium text-txt-muted border border-border rounded-md transition-all duration-150 hover:text-txt-secondary hover:border-border-strong z-20"
      >
        Back
      </button>

      <div className="flex flex-col items-center gap-8 w-full max-w-[440px]">
        {/* Header */}
        <div className="animate-fade-up flex flex-col items-center gap-2">
          <h1 className="font-display text-3xl font-700 letter-tight text-txt-primary">
            Leaderboard
          </h1>
          <div className="rule w-12 mt-1" />
        </div>

        {/* Table */}
        <div className="animate-fade-up-d1 w-full">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-10 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-txt-muted text-center">No records yet.</p>
          ) : (
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-txt-muted text-xs uppercase tracking-wider border-b border-border">
                    <th className="py-3 px-4 text-left font-medium">#</th>
                    <th className="py-3 px-4 text-left font-medium">Player</th>
                    <th className="py-3 px-4 text-right font-medium">Wins</th>
                    <th className="py-3 px-4 text-right font-medium">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const isCurrentUser = r.username === currentUserName;
                    return (
                      <tr
                        key={r.rank}
                        className={`border-t border-border/50 transition-colors duration-100
                          ${i % 2 === 0 ? '' : 'bg-elevated/30'}
                          ${isCurrentUser ? 'bg-accent-subtle' : 'hover:bg-elevated/50'}`}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-txt-muted">{r.rank}</td>
                        <td className={`py-3 px-4 font-medium ${isCurrentUser ? 'text-accent' : 'text-txt-primary'}`}>
                          {r.username || '--'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-txt-secondary">{r.score}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-txt-secondary">{r.subscore}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
