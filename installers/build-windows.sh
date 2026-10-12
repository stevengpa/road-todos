#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Cross-compile from macOS (CGO off — the Windows backend is pure Go) and build
# an NSIS installer with makensis (brew install makensis).
CGO_ENABLED=0 wails build -platform windows/amd64 -nsis -clean

INSTALLER="installers/RoadToDos-1.0.0-windows-amd64-installer.exe"
PORTABLE="installers/RoadToDos-1.0.0-windows-amd64-portable.zip"

rm -f "$INSTALLER" "$PORTABLE"
cp build/bin/road-todo-amd64-installer.exe "$INSTALLER"

( cd build/bin && zip -q "$OLDPWD/$PORTABLE" road-todo.exe )

echo "Created $INSTALLER"
echo "Created $PORTABLE"
