import { useState, useEffect } from 'react';
import { useNakama } from '../context/NakamaContext';
import type { Mark, GameMode } from '../types';

interface GameUIState {
  localMark: Mark;
  isMyTurn: boolean;
  secondsLeft: number;
  board: Mark[];
  gameMode: GameMode;
  opponentName: string;
}

const EMPTY_BOARD: Mark[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export function useGameState(): GameUIState {
  const { matchState, currentUserId, opponentName } = useNakama();
  const [secondsLeft, setSecondsLeft] = useState(0);

  const localMark: Mark = matchState?.marks[currentUserId] ?? 0;
  const isMyTurn = matchState?.turnMark === localMark && localMark !== 0;
  const board = matchState?.board ?? EMPTY_BOARD;
  const gameMode: GameMode = matchState?.mode ?? 'classic';
  const deadline = matchState?.deadline ?? 0;

  useEffect(() => {
    if (gameMode !== 'timed' || deadline === 0) {
      setSecondsLeft(0);
      return;
    }

    const computeSeconds = () =>
      Math.max(0, deadline - Math.floor(Date.now() / 1000));

    setSecondsLeft(computeSeconds());

    const interval = setInterval(() => {
      const remaining = computeSeconds();
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, gameMode]);

  return {
    localMark,
    isMyTurn,
    secondsLeft,
    board,
    gameMode,
    opponentName,
  };
}
