<div align="center">

# Road ToDos

**A local-first roadmap & todo board for your desktop.**

Plan work on a Kanban board, keep an eye on what's due with smart views and a calendar,
and let recurring tasks take care of themselves. No accounts, no network, no cloud —
everything lives in a single SQLite file on your machine.

<sub>Go · Wails v2 · Angular 20 · SQLite — for macOS, Windows & Linux</sub>

<br />

<picture>
  <source srcset="docs/screenshots/Road%20ToDo%20Dark%20mode.png" media="(prefers-color-scheme: dark)">
  <img src="docs/screenshots/Road%20ToDo%20Light%20mode.png" alt="Road ToDos — Kanban board with sidebar, calendar, smart views and drag & drop" width="95%">
</picture>

<br />

<a href="docs/screenshots/Road%20ToDo%20Dark%20mode.png"><img src="docs/screenshots/Road%20ToDo%20Dark%20mode.png" alt="Road ToDos dark mode" width="48%"></a>
<a href="docs/screenshots/Road%20ToDo%20Light%20mode.png"><img src="docs/screenshots/Road%20ToDo%20Light%20mode.png" alt="Road ToDos light mode" width="48%"></a>

</div>

## Features

**Boards & tasks**

- Multiple boards, each with its own stages (columns) and tasks (cards)
- Kanban board with drag & drop — reorder tasks and move them between stages
- Per-board **Table view** that groups tasks by stage, with drag & drop too
- Custom board and stage colors, and reorderable stages
- Task fields: title, description, priority (low / medium / high), due date, tags

**Planning & time**

- **Optional due time** on top of the due date — everything is shown in 12-hour AM/PM
- **Reminders** either at a specific time or a chosen lead time *before* the due date
- **Recurring tasks** — daily, weekly, monthly, yearly, or a custom "every N" cadence;
  completing one rolls it forward to the next occurrence and keeps it open
- **Smart views** (global, across all boards): *Today*, *Overdue*, *No due date* and
  *Next 7 days*, each with a live count
- **Sidebar calendar** with dots on days that have tasks — click a day for an agenda list
- Desktop **notifications** when a reminder fires or a task is due / overdue

**Everyday use**

- Instant search across tasks
- Show / hide completed tasks, plus a live progress bar per board
- Collapsible sidebar
- Light & dark themes
- Everything is saved to local SQLite on every change, and a starter workspace
  is seeded on first launch

## Tech stack

| Layer    | Choice                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| Backend  | Go, [Wails v2](https://wails.io) runtime                                     |
| Frontend | Angular 20 (standalone components, signals, Angular CDK drag & drop)         |
| Storage  | SQLite via pure-Go [`modernc.org/sqlite`](https://gitlab.com/cznic/sqlite)   |
| Packaged | `.app` / `.dmg` for macOS, `.rpm` for Fedora                                 |

The database driver is CGO-free, so the only CGO in the project comes from the
Wails webview runtime itself.

## Architecture

```
Angular UI ──signals──► StateService ──bindings──► App (Go) ──► Store ──► SQLite
                                     ◄────────────  Snapshot  ◄──
```

- **One entrypoint per platform.** `main.go` creates the `App`, configures the
  Wails window and binds the Go API to the webview.
- **A single app layer.** Exported methods on `App` (`app.go`) are the only things
  the frontend can call. On startup the app opens the database, seeds a starter
  workspace if it is empty, and starts a background **reminder loop**.
- **Thin store.** `internal/store` owns all SQL and business rules — recurrence
  roll-over, reminder lead-time math, overdue detection and ordering.
- **Reactive frontend.** `StateService` (`frontend/src/app/state.service.ts`) wraps
  the generated bindings and keeps an in-memory signal store in sync. Views are
  derived with `computed()`, so filters, counts and the calendar update instantly.
- **Auto-generated bindings.** Wails emits typed bindings into
  `frontend/wailsjs/go/main/App.*` from the Go API — no hand-written glue.

A few implementation notes worth knowing:

- **Recurrence** advances the *same* task to its next occurrence (strictly after
  today) and preserves an explicit due time, clearing the "already notified" flags.
- **Reminders** are stored two ways: an absolute `remind_at`, or a `remind_before`
  offset in minutes that is resolved against the due date (date-only due dates are
  anchored at 09:00 local).
- **Overdue is time-aware**: a task with a due time becomes overdue the moment that
  instant passes, while a date-only task is only overdue once its whole day is gone.

## Project layout

```
.
├── app.go                  # Wails-bound application layer (exposed to Angular)
├── main.go                 # Wails entrypoint + window options
├── internal/
│   ├── db/                 # SQLite open + migrations
│   ├── models/             # Domain types shared with the frontend
│   └── store/              # CRUD, recurrence & reminder logic
├── frontend/               # Angular 20 application
│   ├── src/app/            # components + reactive state service
│   └── wailsjs/            # auto-generated Go bindings (do not edit)
├── build/                  # platform assets (icons, packaging)
├── installers/             # DMG / RPM build scripts + SHA256SUMS
└── wails.json              # Wails project configuration
```

## Getting started

### Prerequisites

**macOS**

- [Go 1.25+](https://go.dev/dl/)
- [Node.js 22.12+ or 24.x](https://nodejs.org/) and npm
- Xcode command line tools (`xcode-select --install`)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation):
  `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

**Fedora**

```bash
sudo dnf install golang gcc make pkg-config gtk3-devel webkit2gtk4.1-devel nodejs npm
go install github.com/wailsapp/wails/v2/cmd/wails@latest
export PATH="$PATH:$(go env GOPATH)/bin"
```

> On older Fedora releases that only ship `webkit2gtk-4.0`, install
> `webkit2gtk3-devel` instead and omit the `webkit2_41` build tag below.

Verify the toolchain with `wails doctor`.

### Development

```bash
# from the project root — hot-reloading desktop app
wails dev

# Fedora only: build with the 4.1 webkit tag so wails dev works too
wails dev -tags webkit2_41
```

`wails dev` runs the Angular dev server and injects the Go bindings into the webview.

Run the frontend on its own (no Go bindings, UI only):

```bash
cd frontend
npm install
npm start            # http://localhost:4200
```

## Building

```bash
# macOS (host machine)
wails build

# Fedora (build on Fedora)
wails build -tags webkit2_41

# Windows / other targets from macOS are not supported because the runtime uses CGO
```

The resulting binary is written to `build/bin/`.

### Installers

The `installers/` directory contains scripts and prebuilt artifacts:

| Artifact                                                | Platform                   | Type                  |
| ------------------------------------------------------- | -------------------------- | --------------------- |
| `RoadToDos-1.0.0-macos-universal.dmg`                 | macOS (Intel + Apple)     | Disk image (`.dmg`)   |
| `RoadToDos-1.0.0-windows-amd64-installer.exe`         | Windows (x86_64)          | NSIS installer (`.exe`) |
| `RoadToDos-1.0.0-windows-amd64-portable.zip`          | Windows (x86_64)          | Portable zip (`.zip`) |
| `RoadToDos-1.0.0-fedora-x86_64.rpm`                   | Fedora / RHEL (x86_64)    | RPM package           |
| `RoadToDos-1.0.0-debian-amd64.deb`                    | Debian / Ubuntu (amd64)   | DEB package           |

- `installers/build-macos-dmg.sh` — builds the universal `.app` and packages a `.dmg`.
- `installers/build-fedora-rpm.sh` — builds inside a `fedora:41` container with the
  `webkit2_41` tag and packages an `.rpm` with [`nfpm`](https://nfpm.goreleaser.com/).
- `installers/SHA256SUMS.txt` — checksums for the artifacts above
  (`shasum -a 256 -c SHA256SUMS.txt`).

## Data & storage

Everything is stored in a single SQLite database that lives in your user config
directory:

| Platform | Database location                                      |
| -------- | ------------------------------------------------------ |
| macOS    | `~/Library/Application Support/road-todo/road-todo.db` |
| Fedora   | `~/.config/road-todo/road-todo.db`                     |

Override it with the `ROAD_TODO_DB` environment variable — handy for running a
throwaway demo workspace. The **Open data folder** button in the sidebar takes you
straight to the file.

## Useful commands

```bash
# Go
go test ./...        # run backend tests
go vet ./...         # static analysis

# Frontend
cd frontend
npm run build        # production build into frontend/dist
```

Re-generate the Go ↔ Angular bindings after changing the Go API:

```bash
wails generate module
```
