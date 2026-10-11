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
