import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { Client, Session, Socket } from '@heroiclabs/nakama-js';
import type {
  Screen,
  GameStatePayload,
  EndStatePayload,
  RematchState,
  LeaderboardRecord,
  CustomRoomState,
} from '../types';

function readEnvString(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

const NAKAMA_HOST = readEnvString(import.meta.env.VITE_NAKAMA_HOST, '127.0.0.1');
const NAKAMA_PORT = readEnvString(import.meta.env.VITE_NAKAMA_PORT, '7350');
const NAKAMA_KEY = readEnvString(import.meta.env.VITE_NAKAMA_KEY, 'defaultkey');
const NAKAMA_SSL = readEnvString(import.meta.env.VITE_NAKAMA_SSL, 'false') === 'true';

const STORAGE_DEVICE_ID = 'xoxo_device_id';
const STORAGE_USERNAME = 'xoxo_username';

interface NakamaContextValue {
  screen: Screen;
  matchState: GameStatePayload | null;
  endState: EndStatePayload | null;
  rematchState: RematchState;
  currentUserId: string;
  currentUserName: string;
  opponentName: string;
  restoring: boolean;
  isCustomRoom: boolean;
  customRoomState: CustomRoomState;
  authenticate: (deviceId: string, nickname: string) => Promise<void>;
  joinMatchmaker: (mode: 'classic' | 'timed') => Promise<void>;
  cancelMatchmaking: () => Promise<void>;
  createCustomRoom: (mode: 'classic' | 'timed') => Promise<void>;
  joinCustomRoom: (slug: string) => Promise<void>;
  clearCustomRoomJoinError: () => void;
  sendMove: (position: number) => void;
  sendRematchVote: () => void;
  leaveMatch: () => void;
  logout: () => void;
  showLeaderboard: () => void;
  showCustomRoom: () => void;
  fetchLeaderboard: () => Promise<LeaderboardRecord[]>;
}

const NakamaContext = createContext<NakamaContextValue | null>(null);

export function useNakama(): NakamaContextValue {
  const ctx = useContext(NakamaContext);
  if (!ctx) throw new Error('useNakama must be used within NakamaProvider');
  return ctx;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function NakamaProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<Client | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const ticketRef = useRef<string | null>(null);
  const restoredRef = useRef(false);
  const rematchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [screen, setScreen] = useState<Screen>('home');
  const [matchState, setMatchState] = useState<GameStatePayload | null>(null);
  const [endState, setEndState] = useState<EndStatePayload | null>(null);
  const [rematchState, setRematchState] = useState<RematchState>({
    localVoted: false,
    opponentVoted: false,
    opponentLeft: false,
  });
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [restoring, setRestoring] = useState(() => {
    return !!localStorage.getItem(STORAGE_DEVICE_ID) && !!localStorage.getItem(STORAGE_USERNAME);
  });
  const [isCustomRoom, setIsCustomRoom] = useState(false);
  const [customRoomState, setCustomRoomState] = useState<CustomRoomState>({
    isCreating: false,
    createdSlug: null,
    createError: null,
    isJoining: false,
    joinError: null,
  });

  const clearRematchTimeout = useCallback(() => {
    if (rematchTimeoutRef.current !== null) {
      clearTimeout(rematchTimeoutRef.current);
      rematchTimeoutRef.current = null;
    }
  }, []);

  const cleanupMatch = useCallback(() => {
    clearRematchTimeout();
    matchIdRef.current = null;
    ticketRef.current = null;
    setMatchState(null);
    setEndState(null);
    setRematchState({ localVoted: false, opponentVoted: false, opponentLeft: false });
    setOpponentName('');
    setIsCustomRoom(false);
    setCustomRoomState({ isCreating: false, createdSlug: null, createError: null, isJoining: false, joinError: null });
  }, [clearRematchTimeout]);

  const authenticate = useCallback(async (deviceId: string, nickname: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect(false);
      socketRef.current = null;
    }

    const client = new Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_SSL);
    clientRef.current = client;

    let session: Session;
    try {
      session = await client.authenticateDevice(deviceId, true, nickname);
    } catch (err) {
      const msg = getErrorMessage(err);
      const usernameTaken = msg.includes('Username is already in use') || msg.includes('"code":6');
      if (!usernameTaken) throw err;

      // If username is taken, still create/auth with device ID and set display_name later.
      session = await client.authenticateDevice(deviceId, true);
    }
    sessionRef.current = session;

    try {
      await client.updateAccount(session, { username: nickname, display_name: nickname });
    } catch {
      // username may already be taken; still try to set display_name alone
      try {
        await client.updateAccount(session, { display_name: nickname });
      } catch {
        // ignore
      }
    }

    setCurrentUserId(session.user_id!);
    setCurrentUserName(nickname);

    localStorage.setItem(STORAGE_USERNAME, nickname);

    const socket = client.createSocket(false, false);
    await socket.connect(session, true);
    socketRef.current = socket;

    socket.onmatchdata = (data) => {
      const decoder = new TextDecoder();
      const json = decoder.decode(data.data);
      const payload = JSON.parse(json);

      if (data.op_code === 1) {
        clearRematchTimeout();
        const state = payload as GameStatePayload;
        setMatchState(state);
        setEndState(null);
        setRematchState({ localVoted: false, opponentVoted: false, opponentLeft: false });
        setScreen('game');
      } else if (data.op_code === 3) {
        const end = payload as EndStatePayload;
        setEndState(end);
      } else if (data.op_code === 5) {
        const voterId = payload.voter_id as string;
        const isOpponentVote = voterId !== session.user_id;
        if (isOpponentVote) clearRematchTimeout();
        setRematchState((prev) => ({
          localVoted: voterId === session.user_id ? true : prev.localVoted,
          opponentVoted: isOpponentVote ? true : prev.opponentVoted,
          opponentLeft: false,
        }));
      } else if (data.op_code === 6) {
        clearRematchTimeout();
        setRematchState((prev) => ({ ...prev, opponentLeft: true }));
      }
    };

    socket.onmatchmakermatched = async (matched) => {
      ticketRef.current = null;
      try {
        const mId = matched.match_id ?? matched.token;
        const match = await socket.joinMatch(mId);
        matchIdRef.current = match.match_id;

        for (const p of match.presences ?? []) {
          if (p.user_id !== session.user_id) {
            setOpponentName(p.username);
          }
        }

        setScreen('game');
      } catch {
        setScreen('home');
      }
    };

    socket.onmatchpresence = (event) => {
      if (event.joins) {
        for (const p of event.joins) {
          if (p.user_id !== session.user_id) {
            setOpponentName(p.username);
          }
        }
      }
    };

    socket.ondisconnect = () => {
      cleanupMatch();
      setScreen('home');
    };
  }, [cleanupMatch]);

  // Auto-restore session on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const deviceId = localStorage.getItem(STORAGE_DEVICE_ID);
    const username = localStorage.getItem(STORAGE_USERNAME);

    if (deviceId && username) {
      authenticate(deviceId, username).finally(() => setRestoring(false));
    } else {
      setRestoring(false);
    }
  }, [authenticate]);

  const joinMatchmaker = useCallback(async (mode: 'classic' | 'timed') => {
    const socket = socketRef.current;
    if (!socket) return;
    const ticket = await socket.addMatchmaker(
      `+properties.mode:${mode}`,
      2,
      2,
      { mode },
    );
    ticketRef.current = ticket.ticket;
    setScreen('matchmaking');
  }, []);

  const cancelMatchmaking = useCallback(async () => {
    const socket = socketRef.current;
    if (socket && ticketRef.current) {
      try {
        await socket.removeMatchmaker(ticketRef.current);
      } catch {
        // ticket may already be consumed or socket disconnected
      }
    }
    ticketRef.current = null;
    setScreen('home');
  }, []);

  const showCustomRoom = useCallback(() => {
    setScreen('custom_room');
  }, []);

  const createCustomRoom = useCallback(async (mode: 'classic' | 'timed') => {
    const client = clientRef.current;
    const session = sessionRef.current;
    const socket = socketRef.current;
    if (!client || !session || !socket) return;

    setCustomRoomState((prev) => ({ ...prev, isCreating: true, createError: null }));
    try {
      const result = await client.rpc(session, 'create_custom_room', { mode });
      const { match_id, slug } = result.payload as unknown as { match_id: string; slug: string };
      const match = await socket.joinMatch(match_id);
      matchIdRef.current = match.match_id;
      setIsCustomRoom(true);
      setCustomRoomState((prev) => ({ ...prev, isCreating: false, createdSlug: slug }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorText = msg.includes('could_not_generate_unique_slug')
        ? 'Could not create room, please try again.'
        : 'Failed to create room.';
      setCustomRoomState((prev) => ({ ...prev, isCreating: false, createError: errorText }));
    }
  }, []);

  const joinCustomRoom = useCallback(async (slug: string) => {
    const client = clientRef.current;
    const session = sessionRef.current;
    const socket = socketRef.current;
    if (!client || !session || !socket) return;

    setCustomRoomState((prev) => ({ ...prev, isJoining: true, joinError: null }));
    try {
      const result = await client.rpc(
        session,
        'find_custom_room',
        { slug: slug.toLowerCase().trim() },
      );
      const { match_id } = result.payload as unknown as { match_id: string };
      try {
        const match = await socket.joinMatch(match_id);
        matchIdRef.current = match.match_id;
        for (const p of match.presences ?? []) {
          if (p.user_id !== session.user_id) {
            setOpponentName(p.username);
          }
        }
        setIsCustomRoom(true);
        setCustomRoomState((prev) => ({ ...prev, isJoining: false }));
      } catch (joinErr) {
        const joinMsg = joinErr instanceof Error ? joinErr.message : String(joinErr);
        const errorText = joinMsg.includes('Match is full') ? 'Room is full.' : 'Failed to join room.';
        setCustomRoomState((prev) => ({ ...prev, isJoining: false, joinError: errorText }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let errorText: string;
      if (msg.includes('room_not_found')) {
        errorText = 'Room not found.';
      } else if (msg.includes('invalid payload') || msg.includes('slug is required')) {
        errorText = 'Please enter a room code.';
      } else {
        errorText = 'Failed to join room.';
      }
      setCustomRoomState((prev) => ({ ...prev, isJoining: false, joinError: errorText }));
    }
  }, []);

  const clearCustomRoomJoinError = useCallback(() => {
    setCustomRoomState((prev) => ({ ...prev, joinError: null }));
  }, []);

  const sendMove = useCallback((position: number) => {
    const socket = socketRef.current;
    const mId = matchIdRef.current;
    if (!socket || !mId) return;
    socket.sendMatchState(mId, 2, JSON.stringify({ position }));
  }, []);

  const sendRematchVote = useCallback(() => {
    const socket = socketRef.current;
    const mId = matchIdRef.current;
    if (!socket || !mId) return;
    socket.sendMatchState(mId, 4, JSON.stringify({}));
    setRematchState((prev) => ({ ...prev, localVoted: true }));

    clearRematchTimeout();
    rematchTimeoutRef.current = setTimeout(() => {
      rematchTimeoutRef.current = null;
      setRematchState((prev) => {
        if (prev.opponentLeft || prev.opponentVoted) return prev;
        return { ...prev, opponentLeft: true };
      });
    }, 15_000);
  }, [clearRematchTimeout]);

  const showLeaderboard = useCallback(() => {
    setScreen('leaderboard');
  }, []);

  const leaveMatch = useCallback(() => {
    const socket = socketRef.current;
    const mId = matchIdRef.current;
    if (socket && mId) {
      socket.leaveMatch(mId);
    }
    cleanupMatch();
    setScreen('home');
  }, [cleanupMatch]);

  const logout = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect(false);
      socketRef.current = null;
    }
    clientRef.current = null;
    sessionRef.current = null;
    cleanupMatch();
    setCurrentUserId('');
    setCurrentUserName('');
    localStorage.removeItem(STORAGE_USERNAME);
    localStorage.removeItem(STORAGE_DEVICE_ID);
    setScreen('home');
  }, [cleanupMatch]);

  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardRecord[]> => {
    const client = clientRef.current;
    const session = sessionRef.current;
    if (!client || !session) return [];
    const result = await client.listLeaderboardRecords(
      session,
      'tictactoe_leaderboard',
      [],
      20,
    );
    const records = result.records ?? [];
    const ownerIds = [...new Set(records.map((r) => r.owner_id ?? '').filter(Boolean))];

    const nameMap: Record<string, string> = {};
    const streakMap: Record<string, number> = {};

    const parseStreak = (value: unknown): number => {
      if (!value || typeof value !== 'object') return 0;
      const rawStreak = (value as Record<string, unknown>).streak;
      if (typeof rawStreak === 'number' && Number.isFinite(rawStreak)) {
        return rawStreak;
      }
      if (typeof rawStreak === 'string') {
        const parsed = Number(rawStreak);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return 0;
    };

    const fetchCurrentStreaks = async () => {
      // Attempt a batched storage read first for efficiency.
      try {
        const storageResult = await client.readStorageObjects(session, {
          object_ids: ownerIds.map((uid) => ({
            collection: 'stats',
            key: 'tictactoe',
            user_id: uid,
          })),
        });

        for (const obj of storageResult.objects ?? []) {
          const uid = obj.user_id;
          if (!uid) continue;
          streakMap[uid] = parseStreak(obj.value);
        }
        return;
      } catch {
        // Fall back to per-user reads if batched parsing or request fails.
      }

      await Promise.all(
        ownerIds.map(async (uid) => {
          try {
            const list = await client.listStorageObjects(session, 'stats', uid, 100);
            const statsObj = (list.objects ?? []).find((o) => o.key === 'tictactoe');
            streakMap[uid] = parseStreak(statsObj?.value);
          } catch {
            streakMap[uid] = 0;
          }
        }),
      );
    };

    if (ownerIds.length > 0) {
      await Promise.all([
        (async () => {
          try {
            const users = await client.getUsers(session, ownerIds);
            for (const u of users.users ?? []) {
              nameMap[u.id ?? ''] = u.display_name || u.username || '';
            }
          } catch {
            // fall back to leaderboard username field
          }
        })(),
        fetchCurrentStreaks(),
      ]);
    }

    return records.map((r) => ({
      username: nameMap[r.owner_id ?? ''] || r.username || '',
      score: r.score ?? 0,
      subscore: streakMap[r.owner_id ?? ''] ?? 0,
      rank: r.rank ?? 0,
    }));
  }, []);

  return (
    <NakamaContext.Provider
      value={{
        screen,
        matchState,
        endState,
        rematchState,
        currentUserId,
        currentUserName,
        opponentName,
        restoring,
        isCustomRoom,
        customRoomState,
        authenticate,
        joinMatchmaker,
        cancelMatchmaking,
        createCustomRoom,
        joinCustomRoom,
        clearCustomRoomJoinError,
        sendMove,
        sendRematchVote,
        leaveMatch,
        logout,
        showLeaderboard,
        showCustomRoom,
        fetchLeaderboard,
      }}
    >
      {children}
    </NakamaContext.Provider>
  );
}
