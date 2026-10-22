package models

// User represents an authenticated user.
type User struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// UserCredentials carries login/registration input.
type UserCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Session represents an auth session.
type Session struct {
	ID        string `json:"id"`
	UserID    int64  `json:"userId"`
	ExpiresAt string `json:"expiresAt"`
	CreatedAt string `json:"createdAt"`
}

// Board is a roadmap board that groups columns and cards.
type Board struct {
	ID          int64  `json:"id"`
	UserID      int64  `json:"userId"`
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
	ID            int64  `json:"id"`
	BoardID       int64  `json:"boardId"`
	ColumnID      int64  `json:"columnId"`
	UserID        int64  `json:"userId"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Priority      string `json:"priority"`
	Completed     bool   `json:"completed"`
	DueDate       string `json:"dueDate"`
	RemindAt      string `json:"remindAt"`
	RemindBefore  int    `json:"remindBefore"`
	Tags          string `json:"tags"`
	Recurrence    string `json:"recurrence"`
	RecurInterval int    `json:"recurInterval"`
	RecurUnit     string `json:"recurUnit"`
	Position      int    `json:"position"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
}

// CardInput carries the editable fields used when creating or updating a card.
type CardInput struct {
	ID            int64  `json:"id"`
	BoardID       int64  `json:"boardId"`
	ColumnID      int64  `json:"columnId"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Priority      string `json:"priority"`
	DueDate       string `json:"dueDate"`
	RemindAt      string `json:"remindAt"`
	RemindBefore  int    `json:"remindBefore"`
	Tags          string `json:"tags"`
	Recurrence    string `json:"recurrence"`
	RecurInterval int    `json:"recurInterval"`
	RecurUnit     string `json:"recurUnit"`
}

// Recurrence presets stored on a card. An empty value means the task does not
// repeat. The "custom" preset uses RecurInterval/RecurUnit.
const (
	RecurrenceNone    = ""
	RecurrenceDaily   = "daily"
	RecurrenceWeekly  = "weekly"
	RecurrenceMonthly = "monthly"
	RecurrenceYearly  = "yearly"
	RecurrenceCustom  = "custom"
)

// Recurrence units used by the custom preset.
const (
	RecurUnitDay   = "day"
	RecurUnitWeek  = "week"
	RecurUnitMonth = "month"
	RecurUnitYear  = "year"
)

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
	User    *User     `json:"user"`
	Boards  []Board   `json:"boards"`
	Columns []Column  `json:"columns"`
	Cards   []Card    `json:"cards"`
}

// Settings holds the user's persisted UI preferences.
type Settings struct {
	Theme         string `json:"theme"`
	ShowCompleted bool   `json:"showCompleted"`
}

// Setting keys persisted in the settings table.
const (
	SettingTheme         = "theme"
	SettingShowCompleted = "show_completed"
)

// BoardView is the per-board layout preference (kanban or table).
type BoardView struct {
	BoardID int64  `json:"boardId"`
	View    string `json:"view"`
}
