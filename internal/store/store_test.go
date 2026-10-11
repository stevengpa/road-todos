package store

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"

	"road-todo/internal/models"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	sqlDB, err := sql.Open("sqlite",
		"file:"+path+"?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	if _, err := sqlDB.Exec(`CREATE TABLE boards (
		id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, color TEXT,
		created_at TEXT, updated_at TEXT);
	CREATE TABLE columns (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
		name TEXT, color TEXT, position INTEGER, created_at TEXT);
	CREATE TABLE cards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
		column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
		title TEXT, description TEXT, priority TEXT, completed INTEGER, due_date TEXT, tags TEXT,
		remind_at TEXT NOT NULL DEFAULT '', remind_notified TEXT NOT NULL DEFAULT '', due_notified TEXT NOT NULL DEFAULT '',
		position INTEGER, created_at TEXT, updated_at TEXT);`); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return New(sqlDB)
}

func TestBoardColumnCardLifecycle(t *testing.T) {
	s := newTestStore(t)

	board, err := s.CreateBoard(models.BoardInput{Name: "Test", Color: "#fff"})
	if err != nil {
		t.Fatalf("create board: %v", err)
	}
	if board.ID == 0 {
		t.Fatal("expected board id")
	}

	cols, err := s.listColumns(board.ID)
	if err != nil {
		t.Fatalf("list columns: %v", err)
	}
	if len(cols) != 4 {
		t.Fatalf("expected 4 default columns, got %d", len(cols))
	}

	card, err := s.CreateCard(models.CardInput{
		BoardID: board.ID, ColumnID: cols[0].ID, Title: "First", Priority: "high",
	})
	if err != nil {
		t.Fatalf("create card: %v", err)
	}
	if card.ColumnID != cols[0].ID || card.Position != 0 {
		t.Fatalf("unexpected card: %+v", card)
	}

	if err := s.MoveCard(card.ID, cols[1].ID, 0); err != nil {
		t.Fatalf("move card: %v", err)
	}
	moved, _ := s.getCard(card.ID)
	if moved.ColumnID != cols[1].ID {
		t.Fatalf("card not moved: %+v", moved)
	}

	done, err := s.ToggleComplete(card.ID)
	if err != nil || !done.Completed {
		t.Fatalf("toggle: %v %+v", err, done)
	}

	snap, err := s.Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if len(snap.Boards) != 1 || len(snap.Cards) != 1 {
		t.Fatalf("unexpected snapshot: %+v", snap)
	}

	if err := s.DeleteBoard(board.ID); err != nil {
		t.Fatalf("delete board: %v", err)
	}
	snap, _ = s.Snapshot()
	if len(snap.Boards) != 0 || len(snap.Columns) != 0 || len(snap.Cards) != 0 {
		t.Fatalf("cascade delete failed: %+v", snap)
	}
}

func TestMoveCardNoDuplicates(t *testing.T) {
	s := newTestStore(t)

	board, err := s.CreateBoard(models.BoardInput{Name: "Move", Color: "#fff"})
	if err != nil {
		t.Fatalf("create board: %v", err)
	}
	cols, _ := s.listColumns(board.ID)

	var cards []models.Card
	for _, title := range []string{"A", "B", "C"} {
		c, err := s.CreateCard(models.CardInput{
			BoardID:  board.ID,
			ColumnID: cols[0].ID,
			Title:    title,
		})
		if err != nil {
			t.Fatalf("create card %s: %v", title, err)
		}
		cards = append(cards, c)
	}

	// Move the middle card to the second column.
	if err := s.MoveCard(cards[1].ID, cols[1].ID, 0); err != nil {
		t.Fatalf("move card: %v", err)
	}
	// Reorder within the first column.
	if err := s.MoveCard(cards[2].ID, cols[0].ID, 0); err != nil {
		t.Fatalf("reorder card: %v", err)
	}

	snap, err := s.Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}

	seen := map[int64]int{}
	for _, c := range snap.Cards {
		seen[c.ID]++
	}
	for id, n := range seen {
		if n != 1 {
			t.Fatalf("card %d appears %d times", id, n)
		}
	}
	if len(snap.Cards) != len(cards) {
		t.Fatalf("expected %d cards, got %d", len(cards), len(snap.Cards))
	}
}

func TestReminders(t *testing.T) {
	s := newTestStore(t)

	board, err := s.CreateBoard(models.BoardInput{Name: "R", Color: "#fff"})
	if err != nil {
		t.Fatalf("create board: %v", err)
	}
	cols, _ := s.listColumns(board.ID)

	// A card with a reminder time and due date already in the past.
	past, err := s.CreateCard(models.CardInput{
		BoardID:  board.ID,
		ColumnID: cols[0].ID,
		Title:    "Past",
		DueDate:  "2000-01-01",
		RemindAt: "2000-01-01T09:00",
	})
	if err != nil {
		t.Fatalf("create past card: %v", err)
	}

	// A card scheduled far in the future should not fire yet.
	future, err := s.CreateCard(models.CardInput{
		BoardID:  board.ID,
		ColumnID: cols[0].ID,
		Title:    "Future",
		DueDate:  "2999-01-01",
		RemindAt: "2999-01-01T09:00",
	})
	if err != nil {
		t.Fatalf("create future card: %v", err)
	}

	pending, err := s.PendingReminders()
	if err != nil {
		t.Fatalf("pending: %v", err)
	}
	if len(pending) != 1 || pending[0].ID != past.ID {
		t.Fatalf("expected only the past card pending, got %+v", pending)
	}
	if pending[0].Kind != models.ReminderKindCustom {
		t.Fatalf("expected custom reminder kind, got %q", pending[0].Kind)
	}

	fire, err := s.RemindersToFire()
	if err != nil {
		t.Fatalf("to fire: %v", err)
	}
	if len(fire) != 1 || fire[0].ID != past.ID {
		t.Fatalf("expected one reminder to fire, got %+v", fire)
	}

	if err := s.MarkReminded(fire[0].ID, fire[0].Kind, fire[0].Value()); err != nil {
		t.Fatalf("mark reminded: %v", err)
	}
	again, _ := s.RemindersToFire()
	if len(again) != 0 {
		t.Fatalf("expected no reminders after marking, got %+v", again)
	}

	// Completing a card removes it from pending reminders.
	if _, err := s.ToggleComplete(past.ID); err != nil {
		t.Fatalf("toggle: %v", err)
	}
	if _, err := s.ToggleComplete(future.ID); err != nil {
		t.Fatalf("toggle future: %v", err)
	}
	after, _ := s.PendingReminders()
	if len(after) != 0 {
		t.Fatalf("expected no pending after completion, got %+v", after)
	}
}
