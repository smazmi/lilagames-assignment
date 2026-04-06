export type Mark = 0 | 1 | 2;
export type GameMode = 'classic' | 'timed';
export type Screen = 'home' | 'matchmaking' | 'custom_room' | 'game' | 'leaderboard';
export type EndReason = 'win' | 'draw' | 'timeout' | 'opponent_disconnected';

export interface GameStatePayload {
  board: Mark[];
  turnMark: Mark;
  deadline: number;
  mode: GameMode;
  marks: Record<string, Mark>;
}

export interface EndStatePayload {
  winner_mark: Mark;
  reason: EndReason;
}

export interface RematchState {
  localVoted: boolean;
  opponentVoted: boolean;
  opponentLeft: boolean;
}

export interface LeaderboardRecord {
  username: string;
  score: number;
  subscore: number;
  rank: number;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  streak: number;
}

export interface CustomRoomState {
  isCreating: boolean;
  createdSlug: string | null;
  createError: string | null;
  isJoining: boolean;
  joinError: string | null;
}
