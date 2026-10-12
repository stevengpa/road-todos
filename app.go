package main

import (
	"context"
	"database/sql"
	"fmt"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"sync"
	"sync/atomic"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"road-todo/internal/db"
	"road-todo/internal/models"
	"road-todo/internal/store"
)

// App is the struct exposed to the Angular frontend through Wails bindings.
type App struct {
	ctx         context.Context
	db          *sql.DB
	store       *store.Store
	done        chan struct{}
	closeOnce   sync.Once
	notifyReady atomic.Bool
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
	return &App{db: sqlDB, store: st, done: make(chan struct{})}, nil
}

// startup is called by Wails once the app is ready.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialise notifications, but never block startup on the user granting
	// permission (macOS can wait up to three minutes for a response).
	if wruntime.IsNotificationAvailable(ctx) {
		if err := wruntime.InitializeNotifications(ctx); err == nil {
			a.notifyReady.Store(true)
			go func() { _, _ = wruntime.RequestNotificationAuthorization(ctx) }()
		}
	}

	go a.reminderLoop()
}

// shutdown releases the database connection.
func (a *App) shutdown(ctx context.Context) {
	a.closeOnce.Do(func() { close(a.done) })
	if a.notifyReady.Load() {
		wruntime.CleanupNotifications(ctx)
	}
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

// OpenDBFolder reveals the folder that contains the SQLite database in the
// platform's file manager.
func (a *App) OpenDBFolder() error {
	p, err := db.Path()
	if err != nil {
		return err
	}
	dir := filepath.Dir(p)

	var cmd *exec.Cmd
	switch goruntime.GOOS {
	case "darwin":
		cmd = exec.Command("open", dir)
	case "windows":
		cmd = exec.Command("explorer", dir)
	default:
		cmd = exec.Command("xdg-open", dir)
	}
	return cmd.Start()
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

// PendingReminders returns every card that currently warrants the user's
// attention so the UI can render its reminders panel.
func (a *App) PendingReminders() ([]models.Reminder, error) {
	return a.store.PendingReminders()
}

// reminderLoop periodically sweeps for reminders that have come due and
// announces them once via an OS notification and a frontend event.
func (a *App) reminderLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	select {
	case <-a.done:
		return
	case <-time.After(4 * time.Second):
	}

	a.fireReminders()
	for {
		select {
		case <-a.done:
			return
		case <-ticker.C:
			a.fireReminders()
		}
	}
}

func (a *App) fireReminders() {
	items, err := a.store.RemindersToFire()
	if err != nil {
		return
	}
	// Record and surface every reminder first so a slow OS notification can
	// never prevent the state from being updated.
	for _, r := range items {
		_ = a.store.MarkReminded(r.ID, r.Kind, r.Value())
		if a.ctx != nil {
			wruntime.EventsEmit(a.ctx, "reminder:fired", r)
		}
	}
	for _, r := range items {
		a.sendNotification(r)
	}
}

func (a *App) sendNotification(r models.Reminder) {
	if a.ctx == nil || !a.notifyReady.Load() {
		return
	}
	_ = wruntime.SendNotification(a.ctx, wruntime.NotificationOptions{
		ID:    fmt.Sprintf("road-todo-%d-%s", r.ID, r.Kind),
		Title: r.Title,
		Body:  reminderBody(r),
	})
}

func reminderBody(r models.Reminder) string {
	switch {
	case r.Kind == models.ReminderKindCustom:
		if v := formatStamp(r.RemindAt); v != "" {
			return "Reminder · " + v
		}
		return "Reminder"
	case r.Overdue:
		if v := formatStamp(r.DueDate); v != "" {
			return "Overdue · due " + v
		}
		return "Overdue"
	default:
		return "Due today"
	}
}

// formatStamp renders a stored date or date-time in a friendly 12-hour format.
func formatStamp(value string) string {
	if value == "" {
		return ""
	}
	if t, err := time.ParseInLocation("2006-01-02T15:04", value, time.Local); err == nil {
		return t.Format("Jan 2, 2006 3:04 PM")
	}
	if t, err := time.ParseInLocation("2006-01-02", value, time.Local); err == nil {
		return t.Format("Jan 2, 2006")
	}
	return value
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

// GetSnapshot returns the entire workspace state.
func (a *App) GetSnapshot() (models.Snapshot, error) {
	return a.store.Snapshot()
}

// GetSettings returns the user's persisted UI preferences.
func (a *App) GetSettings() (models.Settings, error) {
	return a.store.Settings()
}

// SetSetting upserts a single UI preference so it survives restarts.
func (a *App) SetSetting(key, value string) error {
	return a.store.SetSetting(key, value)
}

// BoardViews returns the stored layout preference for every board.
func (a *App) BoardViews() ([]models.BoardView, error) {
	return a.store.BoardViews()
}

// SetBoardView remembers the layout a board should open with.
func (a *App) SetBoardView(boardID int64, view string) error {
	return a.store.SetBoardView(boardID, view)
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
