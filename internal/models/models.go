package models

// Board is a roadmap board that groups columns and cards.
type Board struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// Column is a stage/phase inside a board (e.g. Backlog, In Progress, Done).
type Column struct {
	ID        int64  `json:"id"`
	BoardID   int64  `json:"boardId"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	Position  int    `json:"position"`
	CreatedAt string `json:"createdAt"`
}

// Card is a todo item inside a column.
type Card struct {
	ID          int64  `json:"id"`
	BoardID     int64  `json:"boardId"`
	ColumnID    int64  `json:"columnId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
	Completed   bool   `json:"completed"`
	DueDate     string `json:"dueDate"`
	RemindAt    string `json:"remindAt"`
	Tags        string `json:"tags"`
	Position    int    `json:"position"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// CardInput carries the editable fields used when creating or updating a card.
type CardInput struct {
	ID          int64  `json:"id"`
	BoardID     int64  `json:"boardId"`
	ColumnID    int64  `json:"columnId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
	DueDate     string `json:"dueDate"`
	RemindAt    string `json:"remindAt"`
	Tags        string `json:"tags"`
}

// Reminder kinds reported to the frontend.
const (
	ReminderKindCustom = "reminder" // an explicit "remind me at" time was reached
	ReminderKindDue    = "due"      // a card's due date is today or in the past
)

// Reminder describes a card that currently warrants the user's attention.
type Reminder struct {
	ID       int64  `json:"id"`
	BoardID  int64  `json:"boardId"`
	ColumnID int64  `json:"columnId"`
	Title    string `json:"title"`
	Kind     string `json:"kind"`
	DueDate  string `json:"dueDate"`
	RemindAt string `json:"remindAt"`
	Overdue  bool   `json:"overdue"`
}

// Value is the card field that triggered the reminder, used to record that it
// has already been announced.
func (r Reminder) Value() string {
	if r.Kind == ReminderKindCustom {
		return r.RemindAt
	}
	return r.DueDate
}

// BoardInput carries the editable fields of a board.
type BoardInput struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// ColumnInput carries the editable fields of a column.
type ColumnInput struct {
	ID      int64  `json:"id"`
	BoardID int64  `json:"boardId"`
	Name    string `json:"name"`
	Color   string `json:"color"`
}

// Snapshot is the full in-memory state of the workspace.
type Snapshot struct {
	Boards  []Board  `json:"boards"`
	Columns []Column `json:"columns"`
	Cards   []Card   `json:"cards"`
}
