package main

import (
	"context"
	"database/sql"

	"road-todo/internal/db"
	"road-todo/internal/models"
	"road-todo/internal/store"
)

// App is the struct exposed to the Angular frontend through Wails bindings.
type App struct {
	ctx   context.Context
	db    *sql.DB
	store *store.Store
}

// NewApp opens the local SQLite database and prepares the workspace.
func NewApp() (*App, error) {
	sqlDB, err := db.Open()
	if err != nil {
		return nil, err
	}
	st := store.New(sqlDB)
	if err := st.Seed(); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	return &App{db: sqlDB, store: st}, nil
}

// startup is called by Wails once the app is ready.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown releases the database connection.
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		_ = a.db.Close()
	}
}

// DBPath reports where the local database file lives.
func (a *App) DBPath() string {
	p, err := db.Path()
	if err != nil {
		return ""
	}
	return p
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

// GetSnapshot returns the entire workspace state.
func (a *App) GetSnapshot() (models.Snapshot, error) {
	return a.store.Snapshot()
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

func (a *App) CreateBoard(in models.BoardInput) (models.Board, error) {
	return a.store.CreateBoard(in)
}

func (a *App) UpdateBoard(in models.BoardInput) (models.Board, error) {
	return a.store.UpdateBoard(in)
}

func (a *App) DeleteBoard(id int64) error {
	return a.store.DeleteBoard(id)
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

func (a *App) CreateColumn(in models.ColumnInput) (models.Column, error) {
	return a.store.CreateColumn(in)
}

func (a *App) UpdateColumn(in models.ColumnInput) (models.Column, error) {
	return a.store.UpdateColumn(in)
}

func (a *App) DeleteColumn(id int64) error {
	return a.store.DeleteColumn(id)
}

func (a *App) ReorderColumns(boardID int64, ids []int64) error {
	return a.store.ReorderColumns(boardID, ids)
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

func (a *App) CreateCard(in models.CardInput) (models.Card, error) {
	return a.store.CreateCard(in)
}

func (a *App) UpdateCard(in models.CardInput) (models.Card, error) {
	return a.store.UpdateCard(in)
}

func (a *App) DeleteCard(id int64) error {
	return a.store.DeleteCard(id)
}

func (a *App) ToggleComplete(id int64) (models.Card, error) {
	return a.store.ToggleComplete(id)
}

func (a *App) MoveCard(cardID, columnID int64, position int) error {
	return a.store.MoveCard(cardID, columnID, position)
}

func (a *App) ReorderCards(columnID int64, ids []int64) error {
	return a.store.ReorderCards(columnID, ids)
}
