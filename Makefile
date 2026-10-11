SHELL := /bin/bash
WAILS ?= wails

# Fedora ships webkit2gtk-4.1; pass WEBKIT=41 to use the matching build tag.
WEBKIT ?= 41
ifeq ($(WEBKIT),41)
TAGS := -tags webkit2_41
else
TAGS :=
endif

.PHONY: help dev build build-fedora test vet frontend-install frontend-build tidy clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

tidy: ## Tidy Go modules
	go mod tidy

test: ## Run backend tests
	go test ./...

vet: ## Run go vet
	go vet ./...

frontend-install: ## Install Angular dependencies
	cd frontend && npm install

frontend-build: ## Build the Angular frontend into frontend/dist
	cd frontend && npm run build

dev: ## Run the app in hot-reload mode (Fedora: make dev WEBKIT=41)
	$(WAILS) dev $(TAGS)

build: ## Production build for the current platform (macOS)
	$(WAILS) build -clean

build-fedora: ## Production build on Fedora (webkit2gtk-4.1)
	$(WAILS) build -clean -tags webkit2_41

clean: ## Remove build artifacts
	rm -rf build/bin frontend/dist
