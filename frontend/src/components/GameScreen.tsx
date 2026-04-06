import { useState } from 'react';
import { useNakama } from '../context/NakamaContext';
import { useGameState } from '../hooks/useGameState';
import { EndScreen } from './EndScreen';
import type { Mark } from '../types';

const MARK_DISPLAY: Record<Mark, string> = {
  0: '',
  1: 'X',
  2: 'O',
};

export function GameScreen() {
  const { sendMove, leaveMatch, endState, currentUserName } = useNakama();
  const { localMark, isMyTurn, secondsLeft, board, gameMode, opponentName } = useGameState();
  const [moveSent, setMoveSent] = useState(false);

  const boardKey = board.join(',');

  const handleCellClick = (position: number) => {
    if (!isMyTurn || moveSent || board[position] !== 0 || endState) return;
    sendMove(position);
    setMoveSent(true);
  };

  // Reset moveSent when board updates
  const prevBoardKeyRef = useState(boardKey);
  if (prevBoardKeyRef[0] !== boardKey) {
    prevBoardKeyRef[0] = boardKey;
    if (moveSent) setMoveSent(false);
  }

  const disabled = !isMyTurn || moveSent || !!endState;

  const markColor = (mark: Mark): string => {
    if (mark === 1) return 'text-accent';
    if (mark === 2) return 'text-txt-primary';
    return '';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 relative">
      {/* Background glow behind board */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent/[0.02] rounded-full blur-[100px] pointer-events-none" />

      <div className="flex flex-col items-center gap-6 w-full max-w-[400px]">
        {/* Player bar */}
        <div className="animate-fade-up w-full flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-txt-primary">{currentUserName}</span>
            {localMark !== 0 && (
              <span className={`font-mono text-xs font-medium px-1.5 py-0.5 rounded bg-surface border border-border ${markColor(localMark)}`}>
                {MARK_DISPLAY[localMark]}
              </span>
            )}
          </div>
          <span className="text-xs text-txt-muted">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-txt-primary">{opponentName || '...'}</span>
            {localMark !== 0 && (
              <span className={`font-mono text-xs font-medium px-1.5 py-0.5 rounded bg-surface border border-border ${markColor(localMark === 1 ? 2 : 1)}`}>
                {MARK_DISPLAY[localMark === 1 ? 2 : 1]}
              </span>
            )}
          </div>
        </div>

        {/* Turn + Timer row */}
        <div className="animate-fade-up-d1 flex items-center gap-4">
          <span className={`text-sm font-medium transition-colors duration-150 ${isMyTurn ? 'text-accent' : 'text-txt-muted'}`}>
            {isMyTurn ? 'Your turn' : "Opponent's turn"}
          </span>
          {gameMode === 'timed' && (
            <>
              <span className="text-txt-muted">|</span>
              <span className={`font-mono text-sm font-medium tabular-nums ${secondsLeft <= 5 ? 'text-lose' : 'text-txt-secondary'}`}>
                {secondsLeft}s
              </span>
            </>
          )}
        </div>

        {/* Board */}
        <div className="animate-fade-up-d2 relative">
          <div
            className={`grid grid-cols-3 gap-[2px] bg-border rounded-lg overflow-hidden transition-opacity duration-150 ${disabled ? 'opacity-50' : ''}`}
          >
            {board.map((cell, i) => (
              <button
                key={i}
                onClick={() => handleCellClick(i)}
                disabled={disabled || cell !== 0}
                className={`w-[104px] h-[104px] sm:w-[112px] sm:h-[112px] bg-surface font-display text-3xl font-bold flex items-center justify-center transition-all duration-150
                  ${cell === 0 && !disabled ? 'hover:bg-elevated cursor-pointer' : 'cursor-default'}
                  ${markColor(cell)}`}
              >
                {MARK_DISPLAY[cell]}
              </button>
            ))}
          </div>
        </div>

        {/* Leave button */}
        <button
          onClick={leaveMatch}
          className="animate-fade-up-d3 px-5 py-2 text-xs font-medium text-txt-muted transition-colors duration-150 hover:text-txt-secondary"
        >
          Leave
        </button>
      </div>

      {/* End overlay */}
      {endState && <EndScreen localMark={localMark} />}
    </div>
  );
}
