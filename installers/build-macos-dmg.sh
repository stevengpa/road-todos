#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

wails build -clean -platform darwin/universal

STAGE="$(mktemp -d)"
cp -R build/bin/road-todo.app "$STAGE/"
ln -s /Applications "$STAGE/Applications"

VERSION="${ROAD_TODO_VERSION:-1.0.1}"
OUT="installers/RoadToDos-${VERSION}-macos-universal.dmg"
rm -f "$OUT"
diskutil image create from "$STAGE" "$OUT" --volumeName "Road ToDos" --format UDZO
rm -rf "$STAGE"

echo "Created $OUT"
