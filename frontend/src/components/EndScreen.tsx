import { useEffect, useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import type { Mark, LeaderboardRecord } from '../types';

interface EndScreenProps {
  localMark: Mark;
}

export function EndScreen({ localMark }: EndScreenProps) {
  const { endState, rematchState, sendRematchVote, leaveMatch, fetchLeaderboard, isCustomRoom } = useNakama();
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
  const [lbLoading, setLbLoading] = useState(!isCustomRoom);

  useEffect(() => {
    if (!isCustomRoom) {
      fetchLeaderboard().then((r) => {
        setLeaderboard(r);
        setLbLoading(false);
      });
    }
  }, [fetchLeaderboard, isCustomRoom]);

  if (!endState) return null;

  const { winner_mark, reason } = endState;

  let heading: string;
  let headingColor: string;
  if (winner_mark === 0) {
    heading = 'DRAW';
    headingColor = 'text-draw';
  } else if (winner_mark === localMark) {
    heading = 'VICTORY';
    headingColor = 'text-win';
  } else {
    heading = 'DEFEAT';
    headingColor = 'text-lose';
  }

  const reasonText: Record<string, string> = {
    win: winner_mark === localMark ? 'Three in a row.' : 'Outplayed.',
    draw: 'No moves remaining.',
    timeout: 'The clock ran out.',
    opponent_disconnected: 'Opponent disconnected.',
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 bg-base/90 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col items-center gap-8 w-full max-w-[360px]">
        {/* Result */}
        <div className="animate-scale-in flex flex-col items-center gap-2">
          <h2 className={`font-display text-4xl font-800 letter-tighter ${headingColor}`}>
            {heading}
          </h2>
          <p className="text-sm text-txt-muted">{reasonText[reason]}</p>
        </div>

        <div className="rule w-full" />

        {/* Rematch UI */}
        <div className="flex flex-col items-center gap-4 w-full">
          {rematchState.opponentVoted && !rematchState.localVoted && !rematchState.opponentLeft && (
            <p className="text-sm font-medium text-accent animate-fade-up">
              Opponent wants a rematch
            </p>
          )}

          {rematchState.localVoted && !rematchState.opponentVoted && !rematchState.opponentLeft && (
            <div className="flex items-center gap-3 animate-fade-up">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
              <span className="text-sm text-txt-muted">Waiting for opponent</span>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button
              disabled={rematchState.localVoted || rematchState.opponentLeft}
              onClick={rematchState.localVoted || rematchState.opponentLeft ? undefined : sendRematchVote}
              className={`flex-1 px-4 py-3 text-sm font-semibold rounded-md transition-all duration-150 active:scale-[0.98] disabled:active:scale-100
                ${rematchState.opponentLeft
                  ? 'bg-surface border border-border text-txt-muted cursor-not-allowed'
                  : rematchState.localVoted
                    ? 'bg-surface border border-border text-txt-muted cursor-not-allowed opacity-50'
                    : 'bg-accent hover:bg-accent-hover text-[#0a0a0b]'
                }`}
            >
              {rematchState.opponentLeft ? 'Opponent Left' : 'Play Again'}
            </button>
            <button
              onClick={leaveMatch}
              className="flex-1 px-4 py-3 text-sm font-semibold text-txt-secondary bg-surface border border-border rounded-md transition-all duration-150 hover:border-border-strong hover:bg-elevated active:scale-[0.98]"
            >
              New Match
            </button>
          </div>
        </div>

        {/* Leaderboard / custom room note */}
        {isCustomRoom ? (
          <p className="text-xs text-txt-muted">Custom game — no stats recorded</p>
        ) : (
          <div className="w-full">
            <div className="rule w-full mb-4" />
            <h3 className="text-xs font-medium text-txt-muted uppercase tracking-widest mb-3">
              Leaderboard
            </h3>
            {lbLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-8 w-full" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-txt-muted">No records yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-txt-muted text-xs uppercase tracking-wider">
                    <th className="py-2 text-left font-medium">#</th>
                    <th className="py-2 text-left font-medium">Player</th>
                    <th className="py-2 text-right font-medium">Wins</th>
                    <th className="py-2 text-right font-medium">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 10).map((r, i) => (
                    <tr
                      key={r.rank}
                      className={`border-t border-border/50 ${i % 2 === 0 ? '' : 'bg-surface/50'}`}
                    >
                      <td className="py-2 font-mono text-xs text-txt-muted">{r.rank}</td>
                      <td className="py-2 font-medium text-txt-primary">{r.username || '--'}</td>
                      <td className="py-2 text-right font-mono text-xs text-txt-secondary">{r.score}</td>
                      <td className="py-2 text-right font-mono text-xs text-txt-secondary">{r.subscore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
