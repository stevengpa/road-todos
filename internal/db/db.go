package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Path returns the location of the SQLite database file, taking the
// ROAD_TODO_DB environment variable into account.
func Path() (string, error) {
	if p := os.Getenv("ROAD_TODO_DB"); p != "" {
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			return "", err
		}
		return p, nil
	}

	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir = filepath.Join(dir, "road-todo")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "road-todo.db"), nil
}

// Open opens (and migrates) the local SQLite database.
func Open() (*sql.DB, error) {
	path, err := Path()
	if err != nil {
		return nil, err
	}

	dsn := fmt.Sprintf(
		"file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)",
		path,
	)
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}

	// modernc/sqlite serialises writes; a single connection keeps things simple
	// and avoids "database is locked" errors under concurrent calls.
	sqlDB.SetMaxOpenConns(1)

	if err := migrate(sqlDB); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	return sqlDB, nil
}

func migrate(sqlDB *sql.DB) error {
	schema := `
CREATE TABLE IF NOT EXISTS boards (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	name        TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	color       TEXT NOT NULL DEFAULT '#6366f1',
	created_at  TEXT NOT NULL,
	updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS columns (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
	name       TEXT NOT NULL,
	color      TEXT NOT NULL DEFAULT '#64748b',
	position   INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
	column_id   INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
	title       TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	priority    TEXT NOT NULL DEFAULT 'medium',
	completed   INTEGER NOT NULL DEFAULT 0,
	due_date    TEXT NOT NULL DEFAULT '',
	tags        TEXT NOT NULL DEFAULT '',
	position    INTEGER NOT NULL DEFAULT 0,
	created_at  TEXT NOT NULL,
	updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_board ON cards(board_id);
`
	_, err := sqlDB.Exec(schema)
	return err
}
