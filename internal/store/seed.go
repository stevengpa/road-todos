package store

import (
	"database/sql"
	"errors"

	"road-todo/internal/models"
)

// Seed populates a friendly starter workspace the first time the app runs.
func (s *Store) Seed() error {
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM boards`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	board, err := s.CreateBoard(models.BoardInput{
		Name:        "Product Roadmap",
		Description: "Plan, track and ship the next release.",
		Color:       "#6366f1",
	})
	if err != nil {
		return err
	}

	cols, err := s.listColumns(board.ID)
	if err != nil {
		return err
	}
	byName := map[string]int64{}
	for _, c := range cols {
		byName[c.Name] = c.ID
	}

	seedCards := []models.CardInput{
		{
			BoardID:     board.ID,
			ColumnID:    byName["Backlog"],
			Title:       "Research competitor onboarding",
			Description: "Collect the top 5 flows and note the friction points.",
			Priority:    "low",
			Tags:        "research,ux",
		},
		{
			BoardID:     board.ID,
			ColumnID:    byName["Backlog"],
			Title:       "Define success metrics",
			Description: "Pick the 3 numbers we will watch every week.",
			Priority:    "medium",
			Tags:        "metrics",
		},
		{
			BoardID:     board.ID,
			ColumnID:    byName["In Progress"],
			Title:       "Design the board view",
			Description: "Kanban columns with drag and drop between stages.",
			Priority:    "high",
			Tags:        "design,ui",
		},
		{
			BoardID:     board.ID,
			ColumnID:    byName["Review"],
			Title:       "Local SQLite persistence",
			Description: "All data lives on this machine, no cloud required.",
			Priority:    "high",
			Tags:        "backend",
		},
		{
			BoardID:     board.ID,
			ColumnID:    byName["Done"],
			Title:       "Set up Go + Wails + Angular",
			Description: "Desktop shell wired to a local SQLite database.",
			Priority:    "medium",
			Tags:        "setup",
		},
	}

	for _, in := range seedCards {
		if _, err := s.CreateCard(in); err != nil {
			return err
		}
	}

	// Mark the last card complete so the UI shows a mixed state.
	if id := byName["Done"]; id != 0 {
		_ = s.markDone(board.ID)
	}
	return nil
}

func (s *Store) markDone(boardID int64) error {
	_, err := s.db.Exec(
		`UPDATE cards SET completed = 1 WHERE board_id = ? AND column_id = (
			SELECT id FROM columns WHERE board_id = ? AND name = 'Done' LIMIT 1)`,
		boardID, boardID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	return nil
}
