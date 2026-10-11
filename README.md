# Roadmap

A local-first **roadmap / todo board** desktop application for **macOS** and **Linux (Fedora)**.

- **Go** backend with the **Wails v2** runtime
- **Angular 20** frontend (standalone components, signals, Angular CDK drag & drop)
- **SQLite** database stored entirely on your machine (pure-Go `modernc.org/sqlite`, no CGO required for the database)

Everything is handled locally: no accounts, no network, no cloud. The database lives in your
user config directory.

| Platform | Database location                                                  |
| -------- | ------------------------------------------------------------------ |
| macOS    | `~/Library/Application Support/road-todo/road-todo.db`             |
| Fedora   | `~/.config/road-todo/road-todo.db`                                 |

You can override the location with the `ROAD_TODO_DB` environment variable.

## Features

- Multiple boards, each with its own stages (columns) and tasks (cards)
- Kanban board with drag & drop to reorder tasks and move them between stages
- Create / edit / delete boards, stages and tasks
- Task fields: title, description, priority (low/medium/high), due date and tags
- Mark tasks as done, live progress bar per board
- Instant search across tasks
- Light & dark themes
- Everything persisted to local SQLite on every change
- Starter workspace seeded on first launch

## Project layout

```
.
├── app.go                  # Wails-bound application layer (exposed to Angular)
├── main.go                 # Wails entrypoint + window options
├── internal/
│   ├── db/                 # SQLite open + migrations
│   ├── models/             # Domain types shared with the frontend
│   └── store/              # CRUD / persistence layer
├── frontend/               # Angular 20 application
│   ├── src/app/            # components + state service
│   └── wailsjs/            # auto-generated Go bindings (do not edit)
├── build/                  # platform assets (icons, packaging)
└── wails.json              # Wails project configuration
```

## Prerequisites

### macOS

- [Go 1.25+](https://go.dev/dl/)
- [Node.js 22.12+ or 24.x](https://nodejs.org/) and npm
- Xcode command line tools (`xcode-select --install`)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation): `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Fedora

```bash
sudo dnf install golang gcc make pkg-config gtk3-devel webkit2gtk4.1-devel nodejs npm
go install github.com/wailsapp/wails/v2/cmd/wails@latest
export PATH="$PATH:$(go env GOPATH)/bin"
```

> On older Fedora releases that only ship `webkit2gtk-4.0`, install
> `webkit2gtk3-devel` instead and omit the `webkit2_41` build tag below.

Verify the toolchain with `wails doctor`.

## Development

```bash
# from the project root
wails dev            # hot-reloading desktop app

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

### Optional: Fedora RPM package

After `wails build -tags webkit2_41`, an RPM can be produced with
[`nfpm`](https://nfpm.goreleaser.com/):

```bash
go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
nfpm package -f build/linux/nfpm/nfpm.yaml -p rpm
```

## Useful commands

```bash
# Go
go test ./...        # run backend tests
go vet ./...         # static analysis

# Frontend
cd frontend
npm run build        # production build into frontend/dist
```

## How the frontend talks to Go

Methods on the `App` struct in `app.go` are exposed to Angular. Wails generates typed
bindings in `frontend/wailsjs/go/main/App.*`; the Angular `StateService`
(`frontend/src/app/state.service.ts`) wraps them and keeps a reactive signal store in sync.

Re-generate bindings after changing the Go API:

```bash
wails generate module
```
