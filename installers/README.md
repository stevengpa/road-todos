# Installers

Prebuilt installers for **Road ToDos** — a local-first roadmap & todo board.

| File                                    | Platform                    | Type              |
| --------------------------------------- | --------------------------- | ----------------- |
| `RoadToDos-1.0.0-macos-universal.dmg`   | macOS (Intel + Apple Silicon) | Disk image (`.dmg`) |
| `RoadToDos-1.0.0-fedora-x86_64.rpm`     | Fedora / RHEL (x86_64)      | RPM package       |
| `SHA256SUMS.txt`                        | —                           | Checksums         |

> Everything is stored locally in SQLite. No network or account is required.
> Data lives at `~/Library/Application Support/road-todo/road-todo.db` (macOS) and
> `~/.config/road-todo/road-todo.db` (Fedora). Override with `ROAD_TODO_DB`.

## Verify downloads

```bash
# macOS
shasum -a 256 -c SHA256SUMS.txt

# Fedora
sha256sum -c SHA256SUMS.txt
```

## macOS

1. Open `RoadToDos-1.0.0-macos-universal.dmg`.
2. Drag **road-todo** into the **Applications** folder.
3. Launch it from Applications.

The app is **ad-hoc signed** (not notarized), so on first launch macOS may block it:

- **Right-click the app → Open → Open**, or
- **System Settings → Privacy & Security → “Open Anyway”**, or
- Remove the quarantine flag:

  ```bash
  xattr -dr com.apple.quarantine /Applications/road-todo.app
  ```

## Fedora

Install directly with `dnf` (it pulls the `gtk3` and `webkit2gtk4.1` dependencies):

```bash
sudo dnf install ./RoadToDos-1.0.0-fedora-x86_64.rpm
```

Then launch **Road ToDos** from the application grid, or run:

```bash
road-todo
```

Uninstall:

```bash
sudo dnf remove road-todo
```

> Built for **x86_64**. To build an `aarch64` RPM, run the build helper on an
> ARM Fedora host (or adjust `arch` in `../build/linux/nfpm/nfpm.yaml`).

## Rebuilding these installers

The helper scripts reproduce exactly these artifacts.

```bash
# macOS .dmg (run on macOS, requires the Wails CLI)
./installers/build-macos-dmg.sh

# Fedora .rpm (run on Fedora, or from macOS via podman)
./installers/build-fedora-rpm.sh
```

On macOS, the podman helper needs the project folder shared with the podman VM.
If `podman` reports `operation not permitted`, either grant the VM access to the
folder or build on a Fedora machine instead (see the root `README.md`).
