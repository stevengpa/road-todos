package store

import (
	"database/sql"
	"fmt"
	"time"

	"road-todo/internal/models"
)

// Store is the persistence layer backing the application. All access is
// synchronous and guarded by a single SQLite connection.
type Store struct {
	db *sql.DB
}

// New builds a Store around an open database handle.
func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// Snapshot returns the entire workspace in one round-trip.
func (s *Store) Snapshot() (models.Snapshot, error) {
	var snap models.Snapshot

	boards, err := s.listBoards()
	if err != nil {
		return snap, err
	}
	columns, err := s.listColumns(0)
	if err != nil {
		return snap, err
	}
	cards, err := s.listCards(0)
	if err != nil {
		return snap, err
	}

	snap.Boards = boards
	snap.Columns = columns
	snap.Cards = cards
	return snap, nil
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

func (s *Store) listBoards() ([]models.Board, error) {
	rows, err := s.db.Query(
		`SELECT id, name, description, color, created_at, updated_at
		 FROM boards ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Board{}
	for rows.Next() {
		var b models.Board
		if err := rows.Scan(&b.ID, &b.Name, &b.Description, &b.Color, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// CreateBoard inserts a new board and returns it.
func (s *Store) CreateBoard(in models.BoardInput) (models.Board, error) {
	if in.Name == "" {
		in.Name = "Untitled board"
	}
	if in.Color == "" {
		in.Color = "#6366f1"
	}
	ts := now()

	res, err := s.db.Exec(
		`INSERT INTO boards (name, description, color, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
		in.Name, in.Description, in.Color, ts, ts)
	if err != nil {
		return models.Board{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return models.Board{}, err
	}

	// Give every new board a sensible default structure.
	def := []models.ColumnInput{
		{BoardID: id, Name: "Backlog", Color: "#64748b"},
		{BoardID: id, Name: "In Progress", Color: "#3b82f6"},
		{BoardID: id, Name: "Review", Color: "#f59e0b"},
		{BoardID: id, Name: "Done", Color: "#22c55e"},
	}
	for _, c := range def {
		if _, err := s.CreateColumn(c); err != nil {
			return models.Board{}, err
		}
	}

	return s.getBoard(id)
}

func (s *Store) getBoard(id int64) (models.Board, error) {
	var b models.Board
	err := s.db.QueryRow(
		`SELECT id, name, description, color, created_at, updated_at FROM boards WHERE id = ?`, id).
		Scan(&b.ID, &b.Name, &b.Description, &b.Color, &b.CreatedAt, &b.UpdatedAt)
	return b, err
}

// UpdateBoard updates an existing board.
func (s *Store) UpdateBoard(in models.BoardInput) (models.Board, error) {
	if in.Name == "" {
		in.Name = "Untitled board"
	}
	if in.Color == "" {
		in.Color = "#6366f1"
	}
	_, err := s.db.Exec(
		`UPDATE boards SET name = ?, description = ?, color = ?, updated_at = ? WHERE id = ?`,
		in.Name, in.Description, in.Color, now(), in.ID)
	if err != nil {
		return models.Board{}, err
	}
	return s.getBoard(in.ID)
}

// DeleteBoard removes a board together with its columns and cards.
func (s *Store) DeleteBoard(id int64) error {
	_, err := s.db.Exec(`DELETE FROM boards WHERE id = ?`, id)
	return err
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

func (s *Store) listColumns(boardID int64) ([]models.Column, error) {
	query := `SELECT id, board_id, name, color, position, created_at FROM columns`
	args := []any{}
	if boardID > 0 {
		query += ` WHERE board_id = ?`
		args = append(args, boardID)
	}
	query += ` ORDER BY board_id, position, id`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Column{}
	for rows.Next() {
		var c models.Column
		if err := rows.Scan(&c.ID, &c.BoardID, &c.Name, &c.Color, &c.Position, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) getColumn(id int64) (models.Column, error) {
	var c models.Column
	err := s.db.QueryRow(
		`SELECT id, board_id, name, color, position, created_at FROM columns WHERE id = ?`, id).
		Scan(&c.ID, &c.BoardID, &c.Name, &c.Color, &c.Position, &c.CreatedAt)
	return c, err
}

// CreateColumn appends a column to a board.
func (s *Store) CreateColumn(in models.ColumnInput) (models.Column, error) {
	if in.Name == "" {
		in.Name = "New stage"
	}
	if in.Color == "" {
		in.Color = "#64748b"
	}

	var pos int
	if err := s.db.QueryRow(
		`SELECT COALESCE(MAX(position), -1) + 1 FROM columns WHERE board_id = ?`, in.BoardID).
		Scan(&pos); err != nil {
		return models.Column{}, err
	}

	res, err := s.db.Exec(
		`INSERT INTO columns (board_id, name, color, position, created_at) VALUES (?, ?, ?, ?, ?)`,
		in.BoardID, in.Name, in.Color, pos, now())
	if err != nil {
		return models.Column{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return models.Column{}, err
	}
	return s.getColumn(id)
}

// UpdateColumn updates name/color of a column.
func (s *Store) UpdateColumn(in models.ColumnInput) (models.Column, error) {
	if in.Name == "" {
		in.Name = "New stage"
	}
	if in.Color == "" {
		in.Color = "#64748b"
	}
	_, err := s.db.Exec(
		`UPDATE columns SET name = ?, color = ? WHERE id = ?`,
		in.Name, in.Color, in.ID)
	if err != nil {
		return models.Column{}, err
	}
	return s.getColumn(in.ID)
}

// DeleteColumn removes a column and its cards.
func (s *Store) DeleteColumn(id int64) error {
	_, err := s.db.Exec(`DELETE FROM columns WHERE id = ?`, id)
	return err
}

// ReorderColumns rewrites the ordering of a board's columns.
func (s *Store) ReorderColumns(boardID int64, ids []int64) error {
	return s.inTx(func(tx *sql.Tx) error {
		for i, id := range ids {
			if _, err := tx.Exec(
				`UPDATE columns SET position = ? WHERE id = ? AND board_id = ?`, i, id, boardID); err != nil {
				return err
			}
		}
		return nil
	})
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

func (s *Store) listCards(boardID int64) ([]models.Card, error) {
	query := `SELECT id, board_id, column_id, title, description, priority, completed,
	                 due_date, tags, position, created_at, updated_at FROM cards`
	args := []any{}
	if boardID > 0 {
		query += ` WHERE board_id = ?`
		args = append(args, boardID)
	}
	query += ` ORDER BY board_id, column_id, position, id`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Card{}
	for rows.Next() {
		var c models.Card
		var completed int
		if err := rows.Scan(&c.ID, &c.BoardID, &c.ColumnID, &c.Title, &c.Description, &c.Priority,
			&completed, &c.DueDate, &c.Tags, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.Completed = completed == 1
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) getCard(id int64) (models.Card, error) {
	var c models.Card
	var completed int
	err := s.db.QueryRow(
		`SELECT id, board_id, column_id, title, description, priority, completed,
		        due_date, tags, position, created_at, updated_at FROM cards WHERE id = ?`, id).
		Scan(&c.ID, &c.BoardID, &c.ColumnID, &c.Title, &c.Description, &c.Priority,
			&completed, &c.DueDate, &c.Tags, &c.Position, &c.CreatedAt, &c.UpdatedAt)
	c.Completed = completed == 1
	return c, err
}

// CreateCard appends a card to a column.
func (s *Store) CreateCard(in models.CardInput) (models.Card, error) {
	if in.Title == "" {
		in.Title = "Untitled task"
	}
	if in.Priority == "" {
		in.Priority = "medium"
	}

	var pos int
	if err := s.db.QueryRow(
		`SELECT COALESCE(MAX(position), -1) + 1 FROM cards WHERE column_id = ?`, in.ColumnID).
		Scan(&pos); err != nil {
		return models.Card{}, err
	}

	ts := now()
	res, err := s.db.Exec(
		`INSERT INTO cards (board_id, column_id, title, description, priority, completed,
		                    due_date, tags, position, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
		in.BoardID, in.ColumnID, in.Title, in.Description, in.Priority, in.DueDate, in.Tags, pos, ts, ts)
	if err != nil {
		return models.Card{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return models.Card{}, err
	}

	// Touch the parent board so "updated_at" ordering stays meaningful.
	_, _ = s.db.Exec(`UPDATE boards SET updated_at = ? WHERE id = ?`, ts, in.BoardID)
	return s.getCard(id)
}

// UpdateCard updates a card's content.
func (s *Store) UpdateCard(in models.CardInput) (models.Card, error) {
	if in.Title == "" {
		in.Title = "Untitled task"
	}
	if in.Priority == "" {
		in.Priority = "medium"
	}
	_, err := s.db.Exec(
		`UPDATE cards SET column_id = ?, title = ?, description = ?, priority = ?,
		                  due_date = ?, tags = ?, updated_at = ? WHERE id = ?`,
		in.ColumnID, in.Title, in.Description, in.Priority, in.DueDate, in.Tags, now(), in.ID)
	if err != nil {
		return models.Card{}, err
	}
	return s.getCard(in.ID)
}

// DeleteCard removes a card.
func (s *Store) DeleteCard(id int64) error {
	_, err := s.db.Exec(`DELETE FROM cards WHERE id = ?`, id)
	return err
}

// ToggleComplete flips the completed flag.
func (s *Store) ToggleComplete(id int64) (models.Card, error) {
	_, err := s.db.Exec(
		`UPDATE cards SET completed = CASE completed WHEN 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?`,
		now(), id)
	if err != nil {
		return models.Card{}, err
	}
	return s.getCard(id)
}

// MoveCard moves a card into columnID at the given index and normalises order.
func (s *Store) MoveCard(cardID, columnID int64, position int) error {
	card, err := s.getCard(cardID)
	if err != nil {
		return err
	}

	ids, err := s.cardIDs(card.ColumnID, cardID)
	if err != nil {
		return err
	}
	if card.ColumnID != columnID {
		ids, err = s.cardIDs(columnID, 0)
		if err != nil {
			return err
		}
	}

	if position < 0 || position > len(ids) {
		position = len(ids)
	}
	ids = append(ids, 0)
	copy(ids[position+1:], ids[position:])
	ids[position] = cardID

	return s.inTx(func(tx *sql.Tx) error {
		if _, err := tx.Exec(
			`UPDATE cards SET column_id = ?, updated_at = ? WHERE id = ?`, columnID, now(), cardID); err != nil {
			return err
		}
		for i, id := range ids {
			if _, err := tx.Exec(`UPDATE cards SET position = ? WHERE id = ?`, i, id); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) cardIDs(columnID, exclude int64) ([]int64, error) {
	rows, err := s.db.Query(
		`SELECT id FROM cards WHERE column_id = ? AND id <> ? ORDER BY position, id`, columnID, exclude)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ReorderCards rewrites the ordering of cards within a column.
func (s *Store) ReorderCards(columnID int64, ids []int64) error {
	return s.inTx(func(tx *sql.Tx) error {
		for i, id := range ids {
			if _, err := tx.Exec(
				`UPDATE cards SET position = ?, updated_at = ? WHERE id = ? AND column_id = ?`,
				i, now(), id, columnID); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) inTx(fn func(*sql.Tx) error) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("transaction: %w", err)
	}
	return tx.Commit()
}
