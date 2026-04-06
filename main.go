package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"

	"github.com/heroiclabs/nakama-common/runtime"
)

var (
	slugAdjectives = []string{
		"amber", "azure", "bold", "brave", "bright",
		"calm", "clever", "cool", "crisp", "daring",
		"dark", "deft", "eager", "fair", "fast",
		"fierce", "frosty", "golden", "green", "swift",
	}
	slugAnimals = []string{
		"bear", "cobra", "crane", "deer", "eagle",
		"falcon", "fox", "hawk", "jaguar", "lion",
		"lynx", "otter", "panda", "panther", "raven",
		"shark", "tiger", "viper", "wolf", "zebra",
	}
)

func generateSlug() string {
	adj := slugAdjectives[rand.Intn(len(slugAdjectives))]
	animal := slugAnimals[rand.Intn(len(slugAnimals))]
	num := rand.Intn(99) + 1
	return fmt.Sprintf("%s-%s-%d", adj, animal, num)
}

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Tic-Tac-Toe module loaded!")

	// Initialize Leaderboard
	if err := nk.LeaderboardCreate(ctx, "tictactoe_leaderboard", false, "desc", "best", "0 0 * * 0", map[string]interface{}{}, false); err != nil {
		logger.Error("Error creating leaderboard: %v", err)
		return err
	}

	// Register Server-Authoritative Match
	if err := initializer.RegisterMatch("tictactoe", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &Match{}, nil
	}); err != nil {
		return err
	}

	// Register Matchmaker Matched Hook
	if err := initializer.RegisterMatchmakerMatched(MatchmakerMatched); err != nil {
		return err
	}

	// Register Custom Room RPCs
	if err := initializer.RegisterRpc("create_custom_room", rpcCreateCustomRoom); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("find_custom_room", rpcFindCustomRoom); err != nil {
		return err
	}

	return nil
}

// Intercepts matched players and creates a room for them
func MatchmakerMatched(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, entries []runtime.MatchmakerEntry) (string, error) {
	mode := "classic"

	// Check if players queued specifically for timed mode
	if val, ok := entries[0].GetProperties()["mode"].(string); ok {
		mode = val
	}

	matchId, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{
		"mode": mode,
	})
	if err != nil {
		return "", err
	}

	return matchId, nil
}

// rpcCreateCustomRoom creates a private named room and returns its match ID and slug.
// Input:  { "mode": "classic" | "timed" }
// Output: { "match_id": "...", "slug": "amber-fox-42" }
func rpcCreateCustomRoom(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var input struct {
		Mode string `json:"mode"`
	}
	if err := json.Unmarshal([]byte(payload), &input); err != nil || (input.Mode != "classic" && input.Mode != "timed") {
		input.Mode = "classic"
	}

	for attempt := 0; attempt < 5; attempt++ {
		slug := generateSlug()

		matchId, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{
			"mode":   input.Mode,
			"custom": true,
			"slug":   slug,
		})
		if err != nil {
			logger.Error("MatchCreate failed in create_custom_room: %v", err)
			return "", fmt.Errorf("failed to create match")
		}

		roomValue, _ := json.Marshal(map[string]interface{}{
			"match_id": matchId,
			"slug":     slug,
			"mode":     input.Mode,
		})

		_, writeErr := nk.StorageWrite(ctx, []*runtime.StorageWrite{
			{
				Collection:      "custom_rooms",
				Key:             slug,
				UserID:          "",
				Value:           string(roomValue),
				Version:         "*", // create-only; fails if slug already exists
				PermissionRead:  2,
				PermissionWrite: 0,
			},
		})
		if writeErr != nil {
			logger.Warn("Slug collision on attempt %d for slug '%s': %v", attempt+1, slug, writeErr)
			continue
		}

		result, _ := json.Marshal(map[string]interface{}{
			"match_id": matchId,
			"slug":     slug,
		})
		return string(result), nil
	}

	return "", fmt.Errorf("could_not_generate_unique_slug")
}

// rpcFindCustomRoom looks up a custom room by slug and returns its match ID.
// Input:  { "slug": "amber-fox-42" }
// Output: { "match_id": "...", "slug": "amber-fox-42", "mode": "classic" }
func rpcFindCustomRoom(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var input struct {
		Slug string `json:"slug"`
	}
	if err := json.Unmarshal([]byte(payload), &input); err != nil {
		return "", fmt.Errorf("invalid payload")
	}

	slug := strings.ToLower(strings.TrimSpace(input.Slug))
	if slug == "" {
		return "", fmt.Errorf("slug is required")
	}

	records, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{
			Collection: "custom_rooms",
			Key:        slug,
			UserID:     "",
		},
	})
	if err != nil {
		logger.Error("StorageRead error in find_custom_room for slug '%s': %v", slug, err)
		return "", fmt.Errorf("storage error")
	}

	if len(records) == 0 {
		return "", fmt.Errorf("room_not_found")
	}

	return records[0].Value, nil
}
