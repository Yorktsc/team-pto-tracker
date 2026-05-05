#!/usr/bin/env bash
set -euo pipefail

# --- Ensure clean slate ---
# Kill any previous bootstrap and its children (e.g. npm install) that may
# still be running after a runtime container restart.  We compare process
# groups so we only kill sessions from a *previous* SSH invocation — never
# our own session (which shares a PGID with its sh -c wrapper).
my_pgid="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')" || true
for pid in $(pgrep -f 'bootstrap\.sh' 2>/dev/null || true); do
  if [ "$pid" != "$$" ]; then
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')" || true
    if [ -n "$pgid" ] && [ "$pgid" != "$my_pgid" ]; then
      kill -- -"$pgid" 2>/dev/null || true
    fi
  fi
done

TEMPLATE_DIR="$1"              # passed as first argument from server
APP_DIR="${APP_DIR:-$HOME/.appkit-under-dev}"

# Use internal npm mirror when registry.npmjs.org is unreachable (e.g. MicroVMs).
export npm_config_registry="${npm_config_registry:-https://npm-proxy.dev.databricks.com/}"

step() {
  echo "__STEP__ $1"
}

# Clean APP_DIR to an empty state, preserving the .bootstrap staging dir
# and the .bootstrap-done marker file.
clean_workspace() {
  step "Cleaning workspace"
  if [ -d "$APP_DIR" ]; then
    find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name '.bootstrap' ! -name '.bootstrap-done' -exec rm -rf {} +
  fi
  mkdir -p "$APP_DIR"
}

seed_from_template() {
  step "Seeding from template"
  echo "Copying app template..."
  cp -r "$TEMPLATE_DIR/." "$APP_DIR/"
  # Fix read-only permissions from Bazel docker_layer staging.
  find "$APP_DIR" -mindepth 1 -exec chmod u+w {} + 2>/dev/null || true
  rm -rf "$APP_DIR/node_modules"
}

install_deps() {
  step "Installing Node.js dependencies"
  echo "Running npm ci..."
  npm ci --include=dev --ignore-scripts --no-audit --prefix "$APP_DIR"

  # `--ignore-scripts` (security: block third-party lifecycle scripts) also
  # suppresses our own postinstall hook. Reapply local patches explicitly.
  # `npx --no-install` only runs the locally-installed binary so this can
  # never silently fetch arbitrary code from the registry.
  if [ -d "$APP_DIR/patches" ]; then
    step "Applying local patches"
    (cd "$APP_DIR" && npx --no-install patch-package)
  fi
}

init_git() {
  echo "Initializing git repo..."
  git -C "$APP_DIR" init
  git -C "$APP_DIR" config user.email "app-builder@databricks.com"
  git -C "$APP_DIR" config user.name "App Builder"
  git -C "$APP_DIR" add -A
  git -C "$APP_DIR" commit -m "Initial commit"
}

# --- Main ---
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

# Always start from a clean workspace.
clean_workspace
seed_from_template
install_deps
init_git

echo "Working copy ready at $APP_DIR"
