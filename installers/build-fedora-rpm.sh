#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="$PWD"

PAYLOAD="$(mktemp)"
cat > "$PAYLOAD" <<'EOS'
set -euxo pipefail
dnf install -y --setopt=install_weak_deps=False \
  golang gcc gcc-c++ pkg-config gtk3-devel webkit2gtk4.1-devel git tar gzip
export GOPATH=/root/go
export PATH="$PATH:/root/go/bin"
export CGO_ENABLED=1
export GOTOOLCHAIN=auto
export GOPROXY="https://proxy.golang.org,direct"
export GOSUMDB="sum.golang.org"
export GOFLAGS=""

mkdir -p /work
cd /app
tar --exclude=./node_modules --exclude=./.git --exclude=./build/bin --exclude=./installers -cf - . | (cd /work && tar xf -)
cd /work

go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
wails build -s -tags webkit2_41 -platform linux/amd64 -o road-todo

go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
nfpm package -f build/linux/nfpm/nfpm.yaml -p rpm -t /out
EOS

podman run --rm --platform linux/amd64 --security-opt label=disable \
  -v "$PROJECT":/app:ro \
  -v "$PROJECT/installers":/out \
  -v "$PAYLOAD":/build.sh:ro \
  fedora:41 bash /build.sh
rc=$?
rm -f "$PAYLOAD"
echo "Created installers/*.rpm (exit $rc)"
