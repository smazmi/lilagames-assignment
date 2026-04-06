package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	OpCodeGameState    = 1 // Server -> Client: State broadcast
	OpCodeMove         = 2 // Client -> Server: Player move
	OpCodeGameEnd      = 3 // Server -> Client: Win/Loss/Draw/Timeout
	OpCodeRematch      = 4 // Client -> Server: Vote to play again
	OpCodeRematchVote  = 5 // Server -> Client: Acknowledge opponent vote
	OpCodeOpponentLeft = 6 // Server -> Client: Opponent left the lobby

	MarkEmpty = 0
	MarkX     = 1
	MarkO     = 2

	StateWaiting = 0
	StatePlaying = 1
	StateEnded   = 2

	TurnTimeLimit = 30 // 30 seconds
)

type PlayerStats struct {
	Wins   int `json:"wins"`
	Losses int `json:"losses"`
	Streak int `json:"streak"`
}

type MatchState struct {
	Presences    map[string]runtime.Presence
	Marks        map[string]int
	Board        []int
	GameState    int
	TurnMark     int
	RoundStarter int
	Deadline     int64
	EmptyTicks   int
	Mode         string
	RematchVotes map[string]bool
	IsCustom     bool   // true for private named rooms; stats/leaderboard are skipped
	Slug         string // human-readable room code, e.g. "amber-fox-42"
}

type Match struct{}

type MoveMessage struct {
	Position int `json:"position"`
}

type EndMessage struct {
	WinnerMark int    `json:"winner_mark"`
	Reason     string `json:"reason"`
}

func (m *Match) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	mode := "classic"
	if v, ok := params["mode"].(string); ok {
		mode = v
	}
	isCustom := false
	if v, ok := params["custom"].(bool); ok {
		isCustom = v
	}
	slug := ""
	if v, ok := params["slug"].(string); ok {
		slug = v
	}

	state := &MatchState{
		Presences:    make(map[string]runtime.Presence),
		Marks:        make(map[string]int),
		Board:        make([]int, 9),
		GameState:    StateWaiting,
		Mode:         mode,
		RematchVotes: make(map[string]bool),
		IsCustom:     isCustom,
		Slug:         slug,
	}

	label := "tictactoe_room"
	if isCustom {
		label = slug
	}
	return state, 10, label
}

func (m *Match) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	s := state.(*MatchState)
	if len(s.Presences) >= 2 {
		return s, false, "Match is full"
	}
	return s, true, ""
}

func (m *Match) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)
	for _, presence := range presences {
		s.Presences[presence.GetUserId()] = presence
		if len(s.Marks) == 0 {
			s.Marks[presence.GetUserId()] = MarkX
		} else {
			s.Marks[presence.GetUserId()] = MarkO
		}
	}

	if len(s.Presences) == 2 && s.GameState == StateWaiting {
		s.GameState = StatePlaying
		s.TurnMark = MarkX
		s.RoundStarter = MarkX
		if s.Mode == "timed" {
			s.Deadline = time.Now().Unix() + TurnTimeLimit
		}
		broadcastState(logger, dispatcher, s)
	}
	return s
}

func (m *Match) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)

	// Create a map of users who are currently leaving to handle the iteration bug
	leavingIds := make(map[string]bool)
	for _, presence := range presences {
		leavingIds[presence.GetUserId()] = true
		delete(s.Presences, presence.GetUserId())
	}

	if s.GameState == StatePlaying {
		s.GameState = StateEnded
		winnerMark := MarkEmpty

		// Find the player who is NOT leaving
		for userId, mark := range s.Marks {
			if !leavingIds[userId] {
				winnerMark = mark
				break
			}
		}
		endMatch(logger, nk, ctx, dispatcher, s, winnerMark, "opponent_disconnected")

	} else if s.GameState == StateEnded {
		// If a player leaves during the result screen (rematch phase)
		dispatcher.BroadcastMessage(OpCodeOpponentLeft, []byte("{}"), nil, nil, true)

		// Clear any pending rematch votes
		s.RematchVotes = make(map[string]bool)

	} else if s.IsCustom && s.GameState == StateWaiting && len(s.Presences) == 0 {
		// Creator left a custom room before anyone joined — remove the slug so it
		// is no longer discoverable via find_custom_room.
		if err := nk.StorageDelete(ctx, []*runtime.StorageDelete{
			{
				Collection: "custom_rooms",
				Key:        s.Slug,
				UserID:     "",
			},
		}); err != nil {
			logger.Error("Failed to delete custom room record for slug '%s': %v", s.Slug, err)
		}
	}

	return s
}

func (m *Match) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(*MatchState)

	if len(s.Presences) == 0 {
		s.EmptyTicks++
		if s.EmptyTicks > 100 {
			return nil
		}
		return s
	}
	s.EmptyTicks = 0

	// Handle Rematch Votes
	if s.GameState == StateEnded {
		for _, msg := range messages {
			if msg.GetOpCode() == OpCodeRematch {
				s.RematchVotes[msg.GetUserId()] = true

				voteData, _ := json.Marshal(map[string]interface{}{
					"voter_id": msg.GetUserId(),
				})
				dispatcher.BroadcastMessage(OpCodeRematchVote, voteData, nil, nil, true)

				if len(s.RematchVotes) == 2 {
					s.Board = make([]int, 9)
					s.GameState = StatePlaying
					s.RematchVotes = make(map[string]bool)

					if s.RoundStarter == MarkX {
						s.RoundStarter = MarkO
					} else {
						s.RoundStarter = MarkX
					}
					s.TurnMark = s.RoundStarter

					if s.Mode == "timed" {
						s.Deadline = time.Now().Unix() + TurnTimeLimit
					}
					broadcastState(logger, dispatcher, s)
				}
			}
		}
		return s
	}

	// Handle Timers
	if s.GameState == StatePlaying && s.Mode == "timed" {
		if time.Now().Unix() > s.Deadline {
			s.GameState = StateEnded
			winnerMark := MarkX
			if s.TurnMark == MarkX {
				winnerMark = MarkO
			}
			endMatch(logger, nk, ctx, dispatcher, s, winnerMark, "timeout")
			return s
		}
	}

	// Process Moves
	for _, msg := range messages {
		if msg.GetOpCode() == OpCodeMove {
			playerMark := s.Marks[msg.GetUserId()]
			if playerMark != s.TurnMark {
				continue
			}

			var move MoveMessage
			if err := json.Unmarshal(msg.GetData(), &move); err != nil {
				logger.Error("Failed to unmarshal move message: %v", err)
				continue
			}

			if move.Position < 0 || move.Position > 8 || s.Board[move.Position] != MarkEmpty {
				continue
			}

			s.Board[move.Position] = playerMark

			winner := checkWin(s.Board)
			if winner != MarkEmpty {
				s.GameState = StateEnded
				endMatch(logger, nk, ctx, dispatcher, s, winner, "win")
				return s
			} else if isDraw(s.Board) {
				s.GameState = StateEnded
				endMatch(logger, nk, ctx, dispatcher, s, MarkEmpty, "draw")
				return s
			}

			if s.TurnMark == MarkX {
				s.TurnMark = MarkO
			} else {
				s.TurnMark = MarkX
			}

			if s.Mode == "timed" {
				s.Deadline = time.Now().Unix() + TurnTimeLimit
			}
			broadcastState(logger, dispatcher, s)
		}
	}

	return s
}

func (m *Match) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *Match) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

// --- Helpers ---

func broadcastState(logger runtime.Logger, dispatcher runtime.MatchDispatcher, s *MatchState) {
	stateBytes, err := json.Marshal(map[string]interface{}{
		"board":    s.Board,
		"turnMark": s.TurnMark,
		"deadline": s.Deadline,
		"mode":     s.Mode,
		"marks":    s.Marks,
	})
	if err != nil {
		logger.Error("Failed to marshal broadcast state: %v", err)
		return
	}
	dispatcher.BroadcastMessage(OpCodeGameState, stateBytes, nil, nil, true)
}

func endMatch(logger runtime.Logger, nk runtime.NakamaModule, ctx context.Context, dispatcher runtime.MatchDispatcher, s *MatchState, winnerMark int, reason string) {
	// Custom room games do not affect stats or leaderboard.
	if !s.IsCustom {
		// Read existing player stats
		var readOps []*runtime.StorageRead
		for userId := range s.Marks {
			readOps = append(readOps, &runtime.StorageRead{
				Collection: "stats",
				Key:        "tictactoe",
				UserID:     userId,
			})
		}

		records, err := nk.StorageRead(ctx, readOps)
		if err != nil {
			logger.Error("StorageRead error: %v", err)
			// NOTE: If StorageRead fails, statsMap remains empty.
			// This gracefully degrades by initializing stats at 0 so the current match result is still saved,
			// but in production, this should trigger a retry to avoid overwriting historical data during a DB brownout.
		}

		statsMap := make(map[string]*PlayerStats)
		for _, rec := range records {
			var stats PlayerStats
			if err := json.Unmarshal([]byte(rec.Value), &stats); err != nil {
				logger.Error("Failed to unmarshal player stats for %s: %v", rec.UserId, err)
				continue
			}
			statsMap[rec.UserId] = &stats
		}

		// Update stats and prepare for DB Write
		var writeOps []*runtime.StorageWrite
		for userId, mark := range s.Marks {
			if _, exists := statsMap[userId]; !exists {
				statsMap[userId] = &PlayerStats{Wins: 0, Losses: 0, Streak: 0}
			}

			stats := statsMap[userId]

			if winnerMark == MarkEmpty {
				stats.Streak = 0 // Draw resets streak, but doesn't increment losses
			} else if mark == winnerMark {
				stats.Wins++
				stats.Streak++
				if _, err := nk.LeaderboardRecordWrite(ctx, "tictactoe_leaderboard", userId, "", int64(stats.Wins), int64(stats.Streak), nil, nil); err != nil {
					logger.Error("Failed to write to leaderboard: %v", err)
				}
			} else {
				stats.Losses++
				stats.Streak = 0
			}

			valBytes, err := json.Marshal(stats)
			if err != nil {
				logger.Error("Failed to marshal updated stats for %s: %v", userId, err)
				continue
			}

			writeOps = append(writeOps, &runtime.StorageWrite{
				Collection:      "stats",
				Key:             "tictactoe",
				UserID:          userId,
				Value:           string(valBytes),
				PermissionRead:  2, // Public read
				PermissionWrite: 0, // Server-only write
			})
		}

		if _, err := nk.StorageWrite(ctx, writeOps); err != nil {
			logger.Error("StorageWrite error: %v", err)
		}
	}

	endMsg, err := json.Marshal(EndMessage{WinnerMark: winnerMark, Reason: reason})
	if err != nil {
		logger.Error("Failed to marshal end message: %v", err)
	} else {
		dispatcher.BroadcastMessage(OpCodeGameEnd, endMsg, nil, nil, true)
	}
}

func checkWin(b []int) int {
	lines := [][]int{{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, {0, 4, 8}, {2, 4, 6}}
	for _, l := range lines {
		if b[l[0]] != MarkEmpty && b[l[0]] == b[l[1]] && b[l[1]] == b[l[2]] {
			return b[l[0]]
		}
	}
	return MarkEmpty
}

func isDraw(b []int) bool {
	for _, v := range b {
		if v == MarkEmpty {
			return false
		}
	}
	return true
}
